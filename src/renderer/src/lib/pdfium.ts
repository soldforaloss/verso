import { PDFiumLibrary, type PDFiumDocument } from '@hyzyla/pdfium'
// Emit the PDFium wasm as a hashed, app-origin asset (deduped with the wrapper's
// own reference). Vite's `?url` keeps it fully offline — NEVER the CDN entry.
import pdfiumWasmUrl from '@hyzyla/pdfium/pdfium.wasm?url'
import { bgraToRgba } from '@/lib/pdfiumImage'

/**
 * Tier-3 PDFium (WASM) render backend. PDFium is Chrome's PDF engine — it renders
 * inputs pdf.js handles poorly (JBIG2/JPEG2000 scans, blend modes, washed-out
 * graphics) with higher fidelity. This module runs the @hyzyla/pdfium WASM build
 * entirely in the sandboxed renderer: the wasm is fetched from the app origin
 * (a bundled, hashed asset), so there is no network and the existing
 * `wasm-unsafe-eval` CSP that already permits the OCR engine covers it. No new
 * IPC or preload surface.
 *
 * It is render-only (the off-the-shelf WASM build omits the content-editing
 * symbols); pdf-lib remains the structural editor and pdf.js the text/geometry
 * layer. Gated behind the `experimentalPdfiumRenderer` preference.
 */
let libraryPromise: Promise<PDFiumLibrary> | null = null

function getLibrary(): Promise<PDFiumLibrary> {
  if (!libraryPromise) {
    libraryPromise = (async () => {
      const response = await fetch(pdfiumWasmUrl)
      if (!response.ok) throw new Error(`Failed to load PDFium wasm (${response.status})`)
      const wasmBinary = await response.arrayBuffer()
      return PDFiumLibrary.init({ wasmBinary })
    })().catch((error: unknown) => {
      // Allow a later retry if the one-time init failed.
      libraryPromise = null
      throw error
    })
  }
  return libraryPromise
}

// loadDocument parses the WHOLE PDF (xref/objects) and copies its bytes into wasm
// memory, so — like pdf.js — we load each source ONCE and reuse it across page and
// zoom renders. Keyed by the document store's sourceId; freed by
// destroyPdfiumDocument when the source's bytes change or its tab closes (render()
// itself opens and closes each FPDF page, so the cached document leaks no pages).
const documentCache = new Map<string, Promise<PDFiumDocument>>()

function getDocument(sourceId: string, bytes: Uint8Array): Promise<PDFiumDocument> {
  let cached = documentCache.get(sourceId)
  if (!cached) {
    cached = (async () => {
      const library = await getLibrary()
      return library.loadDocument(bytes)
    })().catch((error: unknown) => {
      documentCache.delete(sourceId) // allow retry on failure
      throw error
    })
    documentCache.set(sourceId, cached)
  }
  return cached
}

/** Frees a cached PDFium document. Call when a source's bytes change or it closes. */
export function destroyPdfiumDocument(sourceId: string): void {
  const cached = documentCache.get(sourceId)
  if (!cached) return
  documentCache.delete(sourceId)
  void cached.then((document) => document.destroy()).catch(() => {})
}

/**
 * Renders a 0-based page of a (cached) source to an RGBA `ImageData` at exactly
 * `width` × `height` device pixels — the caller passes the same floored device
 * dimensions the pdf.js path uses so both backends produce byte-identical canvases.
 */
export async function renderPageToImageData(
  sourceId: string,
  bytes: Uint8Array,
  pageIndex: number,
  width: number,
  height: number
): Promise<ImageData> {
  const document = await getDocument(sourceId, bytes)
  const page = document.getPage(pageIndex)
  const result = await page.render({ width, height, render: 'bitmap' })
  return new ImageData(
    bgraToRgba(result.data, result.width, result.height),
    result.width,
    result.height
  )
}
