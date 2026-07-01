import { newAnnotationId, type Annotation } from '@/lib/annotations'
import { addAnnotationsAcrossPages } from '@/lib/annotationOps'
import { getSource, type DocumentTab } from '@/store/documentStore'
import { formatPageLabel } from '@/lib/pageLabel'
import { expandHeaderFooter, HEADER_FOOTER_SLOTS, type HeaderFooterSlot } from '@/lib/headerFooter'
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
}

/** Stamps a centered text watermark onto every page (one undoable command). */
export async function addWatermark(tab: DocumentTab, options: WatermarkOptions): Promise<void> {
  const text = options.text.trim()
  if (!text) return
  const textWidth = measureWidth(text, options.fontSize)
  const byPageKey: Record<string, Annotation[]> = {}
  for (const ref of tab.pages) {
    const size = await logicalPageSize(ref)
    if (!size) continue
    byPageKey[ref.key] = [
      {
        id: newAnnotationId(),
        pageKey: ref.key,
        type: 'text',
        color: options.color,
        opacity: options.opacity,
        fontSize: options.fontSize,
        text,
        rect: {
          x: Math.max(8, (size.width - textWidth) / 2),
          y: (size.height - options.fontSize) / 2,
          width: Math.min(textWidth + 8, size.width),
          height: options.fontSize * 1.4
        }
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
