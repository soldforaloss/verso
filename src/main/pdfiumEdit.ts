import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { app } from 'electron'
import log from 'electron-log/main'
import { init, type WrappedPdfiumModule } from '@embedpdf/pdfium'
import type { LocateTextRequest, LocatedText, EditTextRequest, EditStyle } from '@shared/ipc'

/**
 * Tier-3 **true** content-stream text editing, backed by PDFium (Apache-2.0)
 * compiled to WebAssembly by `@embedpdf/pdfium` (MIT).
 *
 * Unlike the renderer's Tier-2 "cover & replace" overlay — which masks the old
 * glyphs and paints a substitute on top — this edits the genuine text object in
 * the page content stream: `FPDFText_SetText` on the object under the click,
 * `FPDFPage_GenerateContent`, then `PDFiumExt_SaveAsCopy`. The result is real,
 * selectable, searchable text in the original font, with no white box.
 *
 * It runs in the **main** process: the 4.6 MB wasm loads from disk (no renderer
 * bundle bloat, no CSP `wasm-eval`), and the edit is a pure
 * `bytes + point → bytes` function behind a zod-validated IPC channel. The
 * renderer applies the returned bytes via `replaceSource` (the same eager path
 * OCR uses), so what you see is exactly what will be saved.
 */

/** PDFium page-object type for text (`FPDF_PAGEOBJ_TEXT`). */
const PAGEOBJ_TEXT = 1
/** Hit-test padding (PDF points) so clicks near a glyph's edge still register. */
const HIT_PADDING = 2
/** Refuse absurd inputs early (matches the qpdf sidecar's guard). */
const MAX_PDF_BYTES = 512 * 1024 * 1024
/** Cap replacement length; true editing has no reflow, so long strings overrun. */
const MAX_EDIT_CHARS = 2_000

let modulePromise: Promise<WrappedPdfiumModule> | null = null

/**
 * Serializes all access to the single shared PDFium module. PDFium's WASM build
 * is single-threaded and not reentrant; each operation's malloc/load/save runs
 * synchronously today, but chaining through this one-slot lock guarantees two
 * concurrent IPC requests can never interleave on the shared heap even if a
 * future change introduces an `await` mid-operation.
 */
let opLock: Promise<unknown> = Promise.resolve()
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = opLock.then(fn, fn)
  opLock = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

/** Locates the bundled PDFium wasm across dev and packaged layouts. */
function wasmPath(): string {
  const rel = join('node_modules', '@embedpdf', 'pdfium', 'dist', 'pdfium.wasm')
  const candidates = [
    process.env['PDFIUM_WASM_PATH'],
    join(app.getAppPath(), rel), // packaged (inside app.asar; fs redirects if unpacked) and dev
    join(process.cwd(), rel)
  ]
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  // Fall back to the asar path even if existsSync can't stat it; readFileSync
  // still resolves through Electron's asar layer.
  return join(app.getAppPath(), rel)
}

/**
 * Kicks off PDFium initialization in the background (non-blocking) so the first
 * true edit doesn't pay the ~4.6 MB wasm compile cost interactively. Safe to
 * call at startup; failures are swallowed (a real edit will surface them).
 */
export function warmUpPdfium(): void {
  void getModule().catch(() => {})
}

/** Lazily initializes PDFium once; reused for every subsequent edit. */
function getModule(): Promise<WrappedPdfiumModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const wasmBinary = readFileSync(wasmPath())
      const wrapped = await init({ wasmBinary } as Partial<Parameters<typeof init>[0]>)
      wrapped.PDFiumExt_Init()
      log.info('[pdfiumEdit] PDFium initialized')
      return wrapped
    })().catch((error) => {
      // Reset so a transient failure (e.g. missing wasm) can be retried later.
      modulePromise = null
      throw error
    })
  }
  return modulePromise
}

/**
 * The Emscripten runtime members we touch. The upstream `@types/emscripten`
 * reference isn't resolved in our tsconfig (and we don't depend on it), so we
 * narrow `m.pdfium` to exactly the helpers used here in one explicit cast.
 */
interface EmscriptenRuntime {
  wasmExports: { malloc: (size: number) => number; free: (ptr: number) => void }
  HEAPU8: Uint8Array
  getValue: (ptr: number, type: 'float' | 'i32') => number
  setValue: (ptr: number, value: number, type: 'float') => void
  UTF16ToString: (ptr: number) => string
  UTF8ToString: (ptr: number) => string
  stringToUTF16: (str: string, outPtr: number, maxBytesToWrite: number) => void
}

/** Emscripten runtime helpers used for the malloc/copy/read dance. */
interface Runtime {
  malloc: (size: number) => number
  free: (ptr: number) => void
  heap: () => Uint8Array
  getFloat: (ptr: number) => number
  setFloat: (ptr: number, value: number) => void
  getInt: (ptr: number) => number
  readUtf16: (ptr: number) => string
  readUtf8: (ptr: number) => string
  writeUtf16: (text: string, ptr: number, maxBytes: number) => void
}

function runtime(m: WrappedPdfiumModule): Runtime {
  const rt = m.pdfium as unknown as EmscriptenRuntime
  return {
    // Throw on a 0 (out-of-memory) result so callers never write to the wasm
    // null page; `free(0)` is a no-op, so `finally` blocks stay correct.
    malloc: (size) => {
      const ptr = rt.wasmExports.malloc(size)
      if (!ptr && size > 0) throw new Error('PDFium out of memory')
      return ptr
    },
    free: (ptr) => rt.wasmExports.free(ptr),
    // HEAPU8 can be re-pointed when the wasm heap grows, so read it fresh.
    heap: () => rt.HEAPU8,
    getFloat: (ptr) => rt.getValue(ptr, 'float'),
    setFloat: (ptr, value) => rt.setValue(ptr, value, 'float'),
    getInt: (ptr) => rt.getValue(ptr, 'i32'),
    readUtf16: (ptr) => rt.UTF16ToString(ptr),
    readUtf8: (ptr) => rt.UTF8ToString(ptr),
    writeUtf16: (text, ptr, maxBytes) => rt.stringToUTF16(text, ptr, maxBytes)
  }
}

/** PDF FontDescriptor /Flags bits we read. */
const FONT_FLAG_FIXED_PITCH = 0x1
const FONT_FLAG_SERIF = 0x2
const FONT_FLAG_ITALIC = 0x40
const FONT_FLAG_FORCE_BOLD = 0x40000
/** FPDF_FONT_TRUETYPE — the font-type constant for a loaded .ttf. */
const FPDF_FONT_TRUETYPE = 2

/** The three generic families the editor offers (mirrors the overlay). */
type FontFamily = 'sans-serif' | 'serif' | 'monospace'

/** A text object's visual style, as read from / applied to the content stream. */
interface TextStyle {
  sizePt: number
  colorHex: string
  bold: boolean
  italic: boolean
  family: FontFamily
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
}

/** Reads a font handle's UTF-8 name via the two-call (probe-then-read) convention. */
function fontBaseName(m: WrappedPdfiumModule, rt: Runtime, font: number): string {
  if (!font) return ''
  const need = m.FPDFFont_GetBaseFontName(font, 0, 0)
  if (need <= 0) return ''
  const buf = rt.malloc(need)
  try {
    m.FPDFFont_GetBaseFontName(font, buf, need)
    return rt.readUtf8(buf)
  } finally {
    rt.free(buf)
  }
}

/** Reads the object matrix [a,b,c,d,e,f] into a 6-tuple. */
function readMatrix(m: WrappedPdfiumModule, rt: Runtime, obj: number): number[] {
  const mp = rt.malloc(24)
  try {
    if (!m.FPDFPageObj_GetMatrix(obj, mp)) return [1, 0, 0, 1, 0, 0]
    return [0, 4, 8, 12, 16, 20].map((off) => rt.getFloat(mp + off))
  } finally {
    rt.free(mp)
  }
}

/** Writes a 6-tuple matrix onto an object. */
function writeMatrix(m: WrappedPdfiumModule, rt: Runtime, obj: number, mat: number[]): void {
  const mp = rt.malloc(24)
  try {
    mat.forEach((v, i) => rt.setFloat(mp + i * 4, v))
    m.FPDFPageObj_SetMatrix(obj, mp)
  } finally {
    rt.free(mp)
  }
}

/** The on-page (effective) font size = nominal Tf size × the matrix's y-scale. */
function effectiveSize(m: WrappedPdfiumModule, rt: Runtime, obj: number, mat: number[]): number {
  const sp = rt.malloc(4)
  try {
    const nominal = m.FPDFTextObj_GetFontSize(obj, sp) ? rt.getFloat(sp) : 0
    const sy = Math.hypot(mat[2]!, mat[3]!) || 1
    return nominal * sy
  } finally {
    rt.free(sp)
  }
}

/** Reads a text object's current style (size, color, weight, slant, family). */
function readObjectStyle(m: WrappedPdfiumModule, rt: Runtime, obj: number): TextStyle {
  const mat = readMatrix(m, rt, obj)
  const sizePt = effectiveSize(m, rt, obj, mat)

  const cp = rt.malloc(16)
  let colorHex = '#000000'
  try {
    if (m.FPDFPageObj_GetFillColor(obj, cp, cp + 4, cp + 8, cp + 12)) {
      colorHex = `#${toHex(rt.getInt(cp))}${toHex(rt.getInt(cp + 4))}${toHex(rt.getInt(cp + 8))}`
    }
  } finally {
    rt.free(cp)
  }

  const font = m.FPDFTextObj_GetFont(obj)
  const weight = font ? m.FPDFFont_GetWeight(font) : -1
  const flags = font ? m.FPDFFont_GetFlags(font) : 0
  const name = fontBaseName(m, rt, font)
  // Prefer the descriptor's weight/flags. The base-name match is only a fallback
  // when the weight is unknown (<= 0), and deliberately narrow — matching
  // "black"/"heavy" here would misreport a regular-weight display face as bold,
  // and a user "un-bolding" it would then swap away (and discard) the real font.
  const bold =
    weight >= 600 || (flags & FONT_FLAG_FORCE_BOLD) !== 0 || (weight <= 0 && /bold/i.test(name))
  const italic = (flags & FONT_FLAG_ITALIC) !== 0 || /italic|oblique/i.test(name)
  const family: FontFamily =
    (flags & FONT_FLAG_FIXED_PITCH) !== 0 || /mono|courier|consol/i.test(name)
      ? 'monospace'
      : (flags & FONT_FLAG_SERIF) !== 0 || /times|serif|georgia|roman|caladea|cambria/i.test(name)
        ? 'serif'
        : 'sans-serif'
  return { sizePt, colorHex, bold, italic, family }
}

interface TextHit {
  obj: number
  bounds: { left: number; bottom: number; right: number; top: number }
}

/**
 * Finds the text object whose page-space bounding box contains `(x, y)`.
 * Coordinates are PDF user space (origin bottom-left), matching the renderer's
 * page-space point. When boxes overlap, the smallest (most specific) wins.
 */
function findTextObjectAt(
  m: WrappedPdfiumModule,
  rt: Runtime,
  page: number,
  x: number,
  y: number
): TextHit | null {
  const count = m.FPDFPage_CountObjects(page)
  // One allocation for the four out floats (left/bottom/right/top), so an OOM
  // mid-sequence can't leak earlier pointers.
  const box = rt.malloc(16)
  try {
    let best: TextHit | null = null
    let bestArea = Infinity
    for (let i = 0; i < count; i += 1) {
      const obj = m.FPDFPage_GetObject(page, i)
      if (m.FPDFPageObj_GetType(obj) !== PAGEOBJ_TEXT) continue
      if (!m.FPDFPageObj_GetBounds(obj, box, box + 4, box + 8, box + 12)) continue
      const left = rt.getFloat(box)
      const bottom = rt.getFloat(box + 4)
      const right = rt.getFloat(box + 8)
      const top = rt.getFloat(box + 12)
      if (
        x >= left - HIT_PADDING &&
        x <= right + HIT_PADDING &&
        y >= bottom - HIT_PADDING &&
        y <= top + HIT_PADDING
      ) {
        const area = Math.max(0, right - left) * Math.max(0, top - bottom)
        if (area < bestArea) {
          bestArea = area
          best = { obj, bounds: { left, bottom, right, top } }
        }
      }
    }
    return best
  } finally {
    rt.free(box)
  }
}

/** Reads a text object's current string. */
function readObjectText(
  m: WrappedPdfiumModule,
  rt: Runtime,
  textPage: number,
  obj: number
): string {
  // First call (null buffer) returns the length in UTF-16 units incl. the NUL.
  const units = m.FPDFTextObj_GetText(obj, textPage, 0, 0)
  if (units <= 0) return ''
  const buf = rt.malloc(units * 2)
  try {
    m.FPDFTextObj_GetText(obj, textPage, buf, units)
    return rt.readUtf16(buf)
  } finally {
    rt.free(buf)
  }
}

/**
 * Loads `bytes` into a PDFium document, runs `fn`, and always frees both. All
 * access is serialized through {@link serialize} so concurrent requests never
 * share the heap mid-operation.
 */
function withDocument<T>(
  bytes: Uint8Array,
  fn: (m: WrappedPdfiumModule, rt: Runtime, doc: number) => T
): Promise<T> {
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error('PDF exceeds the size limit')
  return serialize(async () => {
    const m = await getModule()
    const rt = runtime(m)
    const ptr = rt.malloc(bytes.byteLength)
    rt.heap().set(bytes, ptr)
    const doc = m.FPDF_LoadMemDocument(ptr, bytes.byteLength, '')
    if (!doc) {
      rt.free(ptr)
      throw new Error('PDFium could not parse the document')
    }
    try {
      return fn(m, rt, doc)
    } finally {
      m.FPDF_CloseDocument(doc)
      rt.free(ptr)
    }
  })
}

/**
 * Returns the text object under `(x, y)` on `pageIndex` — its current string and
 * page-space rect — or null if the point is not over editable text (the caller
 * then falls back to the Tier-2 overlay).
 */
export async function locateText(request: LocateTextRequest): Promise<LocatedText | null> {
  const { bytes, pageIndex, x, y } = request
  return withDocument(bytes, (m, rt, doc) => {
    if (pageIndex < 0 || pageIndex >= m.FPDF_GetPageCount(doc)) return null
    const page = m.FPDF_LoadPage(doc, pageIndex)
    if (!page) return null
    // Page-space hit-testing only lines up on an unrotated page. If the page has
    // an intrinsic /Rotate, bail so the caller falls back to the overlay (which
    // hit-tests in the rotated view space).
    if (m.FPDFPage_GetRotation(page) !== 0) {
      m.FPDF_ClosePage(page)
      return null
    }
    const textPage = m.FPDFText_LoadPage(page)
    try {
      const hit = findTextObjectAt(m, rt, page, x, y)
      if (!hit) return null
      const text = readObjectText(m, rt, textPage, hit.obj)
      const { left, bottom, right, top } = hit.bounds
      return {
        text,
        rect: { x: left, y: bottom, width: right - left, height: top - bottom },
        style: readObjectStyle(m, rt, hit.obj)
      }
    } finally {
      m.FPDFText_ClosePage(textPage)
      m.FPDF_ClosePage(page)
    }
  })
}

/** Sets a text object's string from a JS string (UTF-16 malloc dance). */
function setObjectText(m: WrappedPdfiumModule, rt: Runtime, obj: number, text: string): void {
  const units = text.length + 1
  const wptr = rt.malloc(units * 2)
  try {
    rt.writeUtf16(text, wptr, units * 2)
    if (!m.FPDFText_SetText(obj, wptr)) throw new Error('FPDFText_SetText failed')
  } finally {
    rt.free(wptr)
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/**
 * Applies `newText` + optional `style` to the located object, then regenerates
 * the page content. Color and text-only changes mutate the object in place; a
 * size or font change rebuilds it (PDFium has no in-place font/size setter),
 * preserving the original font (for size-only) or swapping to `style.fontBytes`,
 * and preserving the original position via a scale-normalized matrix.
 */
function applyStyledEdit(
  m: WrappedPdfiumModule,
  rt: Runtime,
  doc: number,
  page: number,
  obj: number,
  newText: string,
  style: EditStyle | undefined
): void {
  if (!style) {
    // Plain text edit — keep the original font, size, colour, and position.
    setObjectText(m, rt, obj, newText)
    if (!m.FPDFPage_GenerateContent(page)) throw new Error('FPDFPage_GenerateContent failed')
    return
  }

  const [r, g, b] = hexToRgb(style.colorHex)
  const original = readObjectStyle(m, rt, obj)
  const sizeChanged = Math.abs(style.sizePt - original.sizePt) > 0.5
  const fontSwap = style.fontBytes !== undefined && style.fontBytes.byteLength > 0

  if (!sizeChanged && !fontSwap) {
    // In place: only text and/or colour changed.
    setObjectText(m, rt, obj, newText)
    if (!m.FPDFPageObj_SetFillColor(obj, r, g, b, 255)) throw new Error('SetFillColor failed')
    if (!m.FPDFPage_GenerateContent(page)) throw new Error('FPDFPage_GenerateContent failed')
    return
  }

  // Rebuild: load the swap font (else reuse the original object's font), create a
  // new text object at the target size, copy text/colour/position, swap it in.
  let loadedFont = 0
  if (fontSwap) {
    const data = style.fontBytes!
    const dp = rt.malloc(data.byteLength)
    try {
      rt.heap().set(data, dp)
      loadedFont = m.FPDFText_LoadFont(doc, dp, data.byteLength, FPDF_FONT_TRUETYPE, true)
    } finally {
      rt.free(dp) // PDFium copies the data in; safe to free now.
    }
    if (!loadedFont) throw new Error('FPDFText_LoadFont failed')
  }
  const font = loadedFont || m.FPDFTextObj_GetFont(obj)
  if (!font) throw new Error('No font available for rebuild')

  const newObj = m.FPDFPageObj_CreateTextObj(doc, font, style.sizePt)
  if (!newObj) {
    if (loadedFont) m.FPDFFont_Close(loadedFont)
    throw new Error('FPDFPageObj_CreateTextObj failed')
  }
  // Until InsertObject adopts it, the new object is caller-owned and NOT freed by
  // FPDF_CloseDocument — so destroy it if any pre-insert step throws.
  let inserted = false
  try {
    setObjectText(m, rt, newObj, newText)
    if (!m.FPDFPageObj_SetFillColor(newObj, r, g, b, 255)) throw new Error('SetFillColor failed')

    // Preserve position/rotation while applying the new size: divide the whole
    // matrix by its y-scale so the y-axis becomes unit length (the object's font
    // size now carries the size) while the x:y aspect ratio — any baked-in
    // horizontal stretch — is retained. Degenerate matrices fall back to identity.
    const [a, mb, mc, md, e, f] = readMatrix(m, rt, obj)
    const sy = Math.hypot(mc!, md!)
    const norm = sy > 1e-6 ? [a! / sy, mb! / sy, mc! / sy, md! / sy, e!, f!] : [1, 0, 0, 1, e!, f!]
    writeMatrix(m, rt, newObj, norm)

    m.FPDFPage_InsertObject(page, newObj)
    inserted = true
    if (!m.FPDFPage_RemoveObject(page, obj)) throw new Error('FPDFPage_RemoveObject failed')
    m.FPDFPageObj_Destroy(obj) // caller owns the removed object — free it.
    if (!m.FPDFPage_GenerateContent(page)) throw new Error('FPDFPage_GenerateContent failed')
  } catch (error) {
    if (!inserted) m.FPDFPageObj_Destroy(newObj)
    throw error
  } finally {
    if (loadedFont) m.FPDFFont_Close(loadedFont) // after GenerateContent embeds it.
  }
}

/**
 * Replaces the text (and optionally the style) of the object under `(x, y)` on
 * `pageIndex`, editing the real content stream, and returns the re-saved PDF
 * bytes. Returns null if no text object is under the point (caller falls back to
 * the overlay).
 */
export async function editText(request: EditTextRequest): Promise<Uint8Array<ArrayBuffer> | null> {
  const { bytes, pageIndex, x, y, newText, style } = request
  if (newText.length > MAX_EDIT_CHARS) throw new Error('Replacement text is too long')
  return withDocument(bytes, (m, rt, doc) => {
    if (pageIndex < 0 || pageIndex >= m.FPDF_GetPageCount(doc)) return null
    const page = m.FPDF_LoadPage(doc, pageIndex)
    if (!page) return null
    // Match locateText: only edit unrotated pages (see the rotation note there).
    if (m.FPDFPage_GetRotation(page) !== 0) {
      m.FPDF_ClosePage(page)
      return null
    }

    // Apply the edit to the page's content stream. Returns false (no return of
    // saved bytes) when nothing sat under the click.
    const applied = ((): boolean => {
      const textPage = m.FPDFText_LoadPage(page)
      try {
        const hit = findTextObjectAt(m, rt, page, x, y)
        if (!hit) return false
        applyStyledEdit(m, rt, doc, page, hit.obj, newText, style)
        return true
      } finally {
        m.FPDFText_ClosePage(textPage)
        m.FPDF_ClosePage(page)
      }
    })()
    if (!applied) return null

    // Serialize the edited document via PDFium's built-in file writer.
    const writer = m.PDFiumExt_OpenFileWriter()
    try {
      if (!m.PDFiumExt_SaveAsCopy(doc, writer)) throw new Error('PDFiumExt_SaveAsCopy failed')
      const size = m.PDFiumExt_GetFileWriterSize(writer)
      if (size <= 0 || size > MAX_PDF_BYTES) throw new Error('Saved PDF size out of range')
      const out = new Uint8Array(new ArrayBuffer(size))
      const obuf = rt.malloc(size)
      try {
        m.PDFiumExt_GetFileWriterData(writer, obuf, size)
        out.set(rt.heap().subarray(obuf, obuf + size))
      } finally {
        rt.free(obuf)
      }
      return out
    } finally {
      m.PDFiumExt_CloseFileWriter(writer)
    }
  })
}
