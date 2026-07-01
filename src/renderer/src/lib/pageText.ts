import { newAnnotationId, type Annotation } from '@/lib/annotations'
import { addAnnotationsAcrossPages } from '@/lib/annotationOps'
import { getSource, type DocumentTab } from '@/store/documentStore'
import { formatPageLabel } from '@/lib/pageLabel'
import { expandHeaderFooter, HEADER_FOOTER_SLOTS, type HeaderFooterSlot } from '@/lib/headerFooter'
import { fitFontSize } from '@/lib/watermarkFit'
import type { PageRef } from '@/lib/pageModel'

export { formatPageLabel }

const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
const measureCtx = measureCanvas?.getContext('2d') ?? null

function measureWidth(text: string, fontSize: number): number {
  if (!measureCtx) return text.length * fontSize * 0.5
  measureCtx.font = `${fontSize}px sans-serif`
  return measureCtx.measureText(text).width
}

/** Unrotated page size (PDF points) — the space annotations are drawn into. */
async function logicalPageSize(ref: PageRef): Promise<{ width: number; height: number } | null> {
  if (ref.kind === 'blank') return { width: ref.width, height: ref.height }
  const source = getSource(ref.sourceId)
  if (!source) return null
  const page = await source.pdf.getPage(ref.sourceIndex + 1)
  const viewport = page.getViewport({ scale: 1, rotation: 0 })
  return { width: viewport.width, height: viewport.height }
}

export interface WatermarkOptions {
  text: string
  opacity: number
  fontSize: number
  color: string
  /** Rotation in degrees (0 = horizontal; 45 = the Adobe-style diagonal). */
  angle: number
}

/** Supersample factor so the rotated watermark text stays crisp when scaled. */
const WATERMARK_RES = 2
/** Hard ceiling on a canvas side (px) — well under Chromium's ~16384 limit. */
const WATERMARK_MAX_SIDE = 8192

/**
 * Renders a centered, rotated, semi-transparent watermark onto a page-sized
 * transparent PNG. The opacity is baked into the image's alpha (image
 * annotations draw opaquely) and rotation is baked in too — so no annotation
 * needs to carry an angle. The font auto-shrinks so long text can't overrun the
 * page, and the canvas resolution is capped for very large pages. Returns a data
 * URL (empty string if canvas is unavailable).
 */
function renderWatermarkPng(text: string, options: WatermarkOptions, w: number, h: number): string {
  // Cap the backing store so an oversized page can't allocate a giant canvas.
  const res = Math.min(WATERMARK_RES, WATERMARK_MAX_SIDE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * res))
  canvas.height = Math.max(1, Math.round(h * res))
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.scale(res, res)
  ctx.translate(w / 2, h / 2)
  ctx.rotate((-options.angle * Math.PI) / 180)

  // Shrink the font so the (rotated) text stays inside the page — no silent clip.
  ctx.font = `bold ${options.fontSize}px sans-serif`
  const fontSize = fitFontSize(options.fontSize, ctx.measureText(text).width, options.angle, w, h)

  ctx.globalAlpha = Math.max(0, Math.min(1, options.opacity))
  ctx.fillStyle = options.color
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Stamps a rotated, semi-transparent text watermark across every page (one
 * undoable command). The watermark is a flattened image (rotation + opacity
 * baked in), so a diagonal "CONFIDENTIAL" renders and saves correctly. One PNG
 * is rendered per unique page size and reused.
 */
export async function addWatermark(tab: DocumentTab, options: WatermarkOptions): Promise<void> {
  const text = options.text.trim()
  if (!text) return
  const pngBySize = new Map<string, string>()
  const byPageKey: Record<string, Annotation[]> = {}
  for (const ref of tab.pages) {
    const size = await logicalPageSize(ref)
    if (!size) continue
    const sizeKey = `${size.width}x${size.height}`
    let dataUrl = pngBySize.get(sizeKey)
    if (dataUrl === undefined) {
      dataUrl = renderWatermarkPng(text, options, size.width, size.height)
      pngBySize.set(sizeKey, dataUrl)
    }
    if (!dataUrl) continue
    byPageKey[ref.key] = [
      {
        id: newAnnotationId(),
        pageKey: ref.key,
        type: 'image',
        color: '#000000',
        // Fully opaque draw of an already-semi-transparent PNG.
        opacity: 1,
        dataUrl,
        rect: { x: 0, y: 0, width: size.width, height: size.height }
      }
    ]
  }
  addAnnotationsAcrossPages(tab.id, byPageKey, 'Add watermark')
}

export type PageNumberPosition = 'bottom-center' | 'bottom-right' | 'top-right'

export interface PageNumberOptions {
  start: number
  fontSize: number
  position: PageNumberPosition
  color: string
  /**
   * Label template with two tokens: `{n}` (the running number, zero-padded to
   * `digits`) and `{total}` (the page count). Examples: `"{n}"` (plain),
   * `"Page {n} of {total}"`, `"ACME-{n}"` (Bates prefix).
   */
  format: string
  /** Zero-pad `{n}` to this many digits (0 = no padding; Bates typically 6). */
  digits: number
}

/**
 * Adds a running page label to every page (one undoable command). Supports plain
 * numbers, "Page N of M", and Bates numbering (prefix + zero-padded sequence)
 * via the `format`/`digits` options.
 */
export async function addPageNumbers(tab: DocumentTab, options: PageNumberOptions): Promise<void> {
  const margin = 28
  const total = tab.pages.length
  const byPageKey: Record<string, Annotation[]> = {}
  for (let i = 0; i < tab.pages.length; i += 1) {
    const ref = tab.pages[i]!
    const size = await logicalPageSize(ref)
    if (!size) continue
    const label = formatPageLabel(options.format, i, options.start, total, options.digits)
    const width = measureWidth(label, options.fontSize)
    const x =
      options.position === 'bottom-center' ? (size.width - width) / 2 : size.width - margin - width
    const y = options.position === 'top-right' ? size.height - margin : margin
    byPageKey[ref.key] = [
      {
        id: newAnnotationId(),
        pageKey: ref.key,
        type: 'text',
        color: options.color,
        opacity: 1,
        fontSize: options.fontSize,
        text: label,
        rect: { x, y, width: width + 4, height: options.fontSize * 1.4 }
      }
    ]
  }
  addAnnotationsAcrossPages(tab.id, byPageKey, 'Add page numbers')
}

/** Margin (PDF points) from the page edge for header/footer text (~0.5 inch). */
const HEADER_FOOTER_MARGIN = 36

export type HeaderFooterSlots = Record<HeaderFooterSlot, string>

export interface HeaderFooterOptions extends HeaderFooterSlots {
  fontSize: number
  color: string
}

/**
 * Adds positioned header/footer text to every page (one undoable command). Each
 * of the six slots (header/footer × left/center/right) is an independent template
 * that expands `{page}`, `{pages}`, `{date}`, and `{filename}`. Empty slots are
 * skipped. Placement mirrors the page-number convention so text always sits
 * inside the page margins; the result flattens on save like any annotation.
 */
export async function addHeaderFooter(
  tab: DocumentTab,
  options: HeaderFooterOptions
): Promise<void> {
  const active = HEADER_FOOTER_SLOTS.filter((s) => options[s.slot].trim() !== '')
  if (active.length === 0) return

  const date = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  const total = tab.pages.length
  const byPageKey: Record<string, Annotation[]> = {}

  for (let i = 0; i < tab.pages.length; i += 1) {
    const ref = tab.pages[i]!
    const size = await logicalPageSize(ref)
    if (!size) continue
    const ctx = { page: i + 1, pages: total, date, filename: tab.name }

    const annotations: Annotation[] = []
    for (const { slot, band, align } of active) {
      const label = expandHeaderFooter(options[slot], ctx).trim()
      if (!label) continue
      const width = measureWidth(label, options.fontSize)
      const x =
        align === 'left'
          ? HEADER_FOOTER_MARGIN
          : align === 'center'
            ? Math.max(HEADER_FOOTER_MARGIN, (size.width - width) / 2)
            : Math.max(HEADER_FOOTER_MARGIN, size.width - HEADER_FOOTER_MARGIN - width)
      // Header: seat the rect's TOP (not its baseline) at the margin so the text
      // stays inside the page for any font size. Footer sits at the bottom margin.
      const height = options.fontSize * 1.4
      const y =
        band === 'header' ? size.height - HEADER_FOOTER_MARGIN - height : HEADER_FOOTER_MARGIN
      annotations.push({
        id: newAnnotationId(),
        pageKey: ref.key,
        type: 'text',
        color: options.color,
        opacity: 1,
        fontSize: options.fontSize,
        text: label,
        rect: { x, y, width: width + 4, height }
      })
    }
    if (annotations.length > 0) byPageKey[ref.key] = annotations
  }
  addAnnotationsAcrossPages(tab.id, byPageKey, 'Add header & footer')
}
