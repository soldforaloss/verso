// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'

// The engine touches Electron only for the wasm path + logging. Mock both so the
// pure PDFium edit logic can run under Node (it needs no browser/Electron APIs).
vi.mock('electron', () => ({ app: { getAppPath: () => process.cwd() } }))
vi.mock('electron-log/main', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {} }
}))

import { editText, locateText } from '../../src/main/pdfiumEdit'

/** A one-page PDF with two text objects at known baselines. */
async function makeDoc(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Hello World', { x: 50, y: 220, size: 24, font, color: rgb(0.1, 0.1, 0.1) })
  page.drawText('second line', { x: 50, y: 120, size: 18, font, color: rgb(0, 0, 0) })
  return doc.save()
}

describe('PDFium true text editing (Tier 3)', () => {
  let bytes: Uint8Array
  beforeEach(async () => {
    bytes = await makeDoc()
  })

  it('locates the text object under a click and returns its string + rect', async () => {
    const hit = await locateText({ bytes, pageIndex: 0, x: 90, y: 228 })
    expect(hit).not.toBeNull()
    expect(hit!.text).toBe('Hello World')
    // Rect is page space (origin bottom-left): left near 50, sits in the top half.
    expect(hit!.rect.x).toBeGreaterThan(40)
    expect(hit!.rect.x).toBeLessThan(60)
    expect(hit!.rect.y).toBeGreaterThan(150)
    expect(hit!.rect.width).toBeGreaterThan(0)
    expect(hit!.rect.height).toBeGreaterThan(0)
  })

  it('hit-tests the nearest of overlapping/stacked objects (picks the lower line)', async () => {
    const hit = await locateText({ bytes, pageIndex: 0, x: 90, y: 126 })
    expect(hit?.text).toBe('second line')
  })

  it('returns null when the click is over empty space', async () => {
    expect(await locateText({ bytes, pageIndex: 0, x: 5, y: 5 })).toBeNull()
    // Off-page index is also a clean miss, not a throw.
    expect(await locateText({ bytes, pageIndex: 9, x: 90, y: 228 })).toBeNull()
  })

  it('replaces the real content-stream text and round-trips on reload', async () => {
    const edited = await editText({ bytes, pageIndex: 0, x: 90, y: 228, newText: 'Goodbye Moon' })
    expect(edited).not.toBeNull()

    // Structurally valid and page-count preserved.
    const reloaded = await PDFDocument.load(edited!)
    expect(reloaded.getPageCount()).toBe(1)

    // The new text is genuinely in the stream (locatable at the same spot)...
    const after = await locateText({ bytes: edited!, pageIndex: 0, x: 90, y: 228 })
    expect(after?.text).toBe('Goodbye Moon')

    // ...and the untouched line still reads back unchanged.
    const other = await locateText({ bytes: edited!, pageIndex: 0, x: 90, y: 126 })
    expect(other?.text).toBe('second line')
  })

  it('leaves the original bytes unmodified (edit is a pure function)', async () => {
    const before = bytes.slice()
    await editText({ bytes, pageIndex: 0, x: 90, y: 228, newText: 'mutated?' })
    expect(Array.from(bytes)).toEqual(Array.from(before))
  })

  it('returns null when editing over empty space (caller falls back to overlay)', async () => {
    expect(await editText({ bytes, pageIndex: 0, x: 5, y: 5, newText: 'x' })).toBeNull()
  })

  it('refuses an intrinsically rotated page (locate + edit fall back to overlay)', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([400, 300])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    page.drawText('Rotated heading', { x: 50, y: 220, size: 24, font })
    page.setRotation(degrees(90))
    const rotated = await doc.save()

    // Page-space hit-testing can't be trusted on a rotated page, so the engine
    // bails — the renderer then uses the (rotation-agnostic) overlay.
    expect(await locateText({ bytes: rotated, pageIndex: 0, x: 90, y: 228 })).toBeNull()
    expect(
      await editText({ bytes: rotated, pageIndex: 0, x: 90, y: 228, newText: 'nope' })
    ).toBeNull()
  })

  // --- Style editing ---------------------------------------------------------

  it('reports the located object style (size, colour, family)', async () => {
    const hit = await locateText({ bytes, pageIndex: 0, x: 90, y: 228 })
    expect(hit?.style).toBeDefined()
    expect(Math.round(hit!.style.sizePt)).toBe(24)
    expect(hit!.style.colorHex).toMatch(/^#[0-9a-f]{6}$/)
    // Helvetica → sans-serif, regular weight.
    expect(hit!.style.family).toBe('sans-serif')
    expect(hit!.style.bold).toBe(false)
  })

  it('changes colour in place (no rebuild), preserving size and text', async () => {
    const edited = await editText({
      bytes,
      pageIndex: 0,
      x: 90,
      y: 228,
      newText: 'Hello World',
      style: { sizePt: 24, colorHex: '#cc2222' }
    })
    expect(edited).not.toBeNull()
    const after = await locateText({ bytes: edited!, pageIndex: 0, x: 90, y: 228 })
    expect(after?.text).toBe('Hello World')
    expect(after?.style.colorHex).toBe('#cc2222')
    expect(Math.round(after!.style.sizePt)).toBe(24)
  })

  it('changes font size by rebuilding, preserving text and position', async () => {
    const edited = await editText({
      bytes,
      pageIndex: 0,
      x: 90,
      y: 228,
      newText: 'Hello World',
      style: { sizePt: 40, colorHex: '#1a1a1a' }
    })
    expect(edited).not.toBeNull()
    const after = await locateText({ bytes: edited!, pageIndex: 0, x: 90, y: 232 })
    expect(after?.text).toBe('Hello World')
    expect(Math.round(after!.style.sizePt)).toBe(40)
    // Same left origin (position preserved through the rebuild).
    expect(after!.rect.x).toBeGreaterThan(40)
    expect(after!.rect.x).toBeLessThan(60)
  })

  it('swaps to a bold font when given font bytes (weight change)', async () => {
    const bold = new Uint8Array(
      readFileSync(join(process.cwd(), 'resources', 'fonts', 'LiberationSans-Bold.ttf'))
    )
    const edited = await editText({
      bytes,
      pageIndex: 0,
      x: 90,
      y: 228,
      newText: 'Hello World',
      style: { sizePt: 24, colorHex: '#1a1a1a', fontBytes: bold }
    })
    expect(edited).not.toBeNull()
    const after = await locateText({ bytes: edited!, pageIndex: 0, x: 90, y: 228 })
    expect(after?.text).toBe('Hello World')
    expect(after?.style.bold).toBe(true)
  })

  it('does not drop a style-only change when the text is unchanged', async () => {
    // Same string, only the colour differs — must still be applied.
    const edited = await editText({
      bytes,
      pageIndex: 0,
      x: 90,
      y: 228,
      newText: 'Hello World',
      style: { sizePt: 24, colorHex: '#00aa00' }
    })
    const after = await locateText({ bytes: edited!, pageIndex: 0, x: 90, y: 228 })
    expect(after?.style.colorHex).toBe('#00aa00')
  })
})
