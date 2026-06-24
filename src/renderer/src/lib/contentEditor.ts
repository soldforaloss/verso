import { newAnnotationId, type Annotation, type Point, type Rect } from '@/lib/annotations'
import type { PdfPage } from '@/lib/pdf'

export interface EditTextInput {
  page: PdfPage
  pageKey: string
  /** Click location in PDF page space (origin bottom-left). */
  point: Point
  /** Returns a hex color for a page-space rect, sampled from the rendered page. */
  sampleBackground: (rect: Rect) => string
}

/**
 * Strategy for editing *existing* page content.
 *
 * Tier 2 ({@link OverlayContentEditor}) covers the target run with a
 * background-matched rectangle and drops an editable text box pre-filled with
 * the original string, flattening on save. A future Tier 3 (a PDFium native
 * addon) can implement this same interface with true content-stream edits —
 * this is the clean swap point.
 */
export interface ContentEditor {
  /**
   * Replaces the text run at `point` with editable annotations (a cover plus a
   * pre-filled text box). Returns the annotations to add, or null if no run is
   * under the point.
   */
  editTextRun(input: EditTextInput): Promise<Annotation[] | null>
}

/**
 * Tier 2 — pragmatic "cover & replace" editing using the annotation layer.
 *
 * Honest limits (the same approach mainstream consumer editors use): the
 * background match is a single sampled pixel (imperfect on gradients/images),
 * the font is a best-effort sans-serif fallback, and there is no text reflow.
 */
export class OverlayContentEditor implements ContentEditor {
  async editTextRun({
    page,
    pageKey,
    point,
    sampleBackground
  }: EditTextInput): Promise<Annotation[] | null> {
    const content = await page.getTextContent()

    for (const item of content.items) {
      if (!('transform' in item) || item.str.trim() === '') continue
      const transform = item.transform
      const fontHeight = Math.hypot(transform[2], transform[3]) || 12
      const x = transform[4]
      const baseline = transform[5]
      const rect: Rect = {
        x,
        y: baseline - fontHeight * 0.25,
        width: item.width,
        height: fontHeight * 1.25
      }
      const hit =
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height
      if (!hit) continue

      const cover: Annotation = {
        id: newAnnotationId(),
        pageKey,
        type: 'rect',
        color: sampleBackground(rect),
        opacity: 1,
        strokeWidth: 0,
        filled: true,
        rect: { x: rect.x - 1, y: rect.y - 1, width: rect.width + 2, height: rect.height + 2 }
      }
      const text: Annotation = {
        id: newAnnotationId(),
        pageKey,
        type: 'text',
        color: '#111111',
        opacity: 1,
        fontSize: Math.max(6, Math.round(fontHeight)),
        text: item.str,
        rect
      }
      return [cover, text]
    }

    return null
  }
}
