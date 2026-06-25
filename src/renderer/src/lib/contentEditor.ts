import { newAnnotationId, type Annotation, type Point, type Rect } from '@/lib/annotations'
import { inferTextFontStyle } from '@/lib/textStyle'
import { matchBundledFont } from '@/lib/fonts'
import type { PdfPage } from '@/lib/pdf'

export interface EditTextInput {
  page: PdfPage
  pageKey: string
  /** Click location in PDF page space (origin bottom-left). */
  point: Point
  /** Returns a hex color for a page-space rect, sampled from the rendered page. */
  sampleBackground: (rect: Rect) => string
  /** Returns the run's ink (text) color, sampled from the rendered page. */
  sampleInkColor: (rect: Rect) => string
  /** Measures a string's natural width (PDF points) in the given CSS font. */
  measureTextWidth: (
    text: string,
    fontSize: number,
    cssFamily: string,
    bold: boolean,
    italic: boolean
  ) => number
}

/** Minimal shape of the PDF.js font object kept in `page.commonObjs`. */
interface PdfFontObject {
  name?: string
}
interface PdfObjects {
  has(id: string): boolean
  get(id: string): PdfFontObject | undefined
}

/**
 * Strategy for editing *existing* page content.
 *
 * Tier 2 ({@link OverlayContentEditor}) covers the target run with a
 * background-matched rectangle and drops an editable text box pre-filled with
 * the original string — matching its color, size, and (best-effort) font face —
 * flattening on save. A future Tier 3 (a PDFium native addon) can implement this
 * same interface with true content-stream edits — this is the clean swap point.
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
 * background and ink colors are sampled from the rendered pixels (imperfect on
 * gradients/images), the font face is inferred from the run's font name, and
 * there is no text reflow.
 */
export class OverlayContentEditor implements ContentEditor {
  async editTextRun({
    page,
    pageKey,
    point,
    sampleBackground,
    sampleInkColor,
    measureTextWidth
  }: EditTextInput): Promise<Annotation[] | null> {
    const content = await page.getTextContent()
    const commonObjs = (page as unknown as { commonObjs?: PdfObjects }).commonObjs

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

      // Infer the original face from the run's font name (PostScript name from
      // the loaded font object, plus the text layer's CSS family as a hint).
      const fontName = item.fontName
      let psName: string | undefined
      try {
        if (fontName && commonObjs?.has(fontName)) psName = commonObjs.get(fontName)?.name
      } catch {
        /* font not resolved yet — fall back to the style family */
      }
      const styleFamily = fontName ? content.styles?.[fontName]?.fontFamily : undefined
      const face = inferTextFontStyle(psName, styleFamily)
      const fontSize = Math.max(6, Math.round(fontHeight))

      // If the run uses a font we ship a metric-compatible substitute for
      // (Calibri→Carlito, Cambria→Caladea), embed that — its widths match, so
      // no spacing correction is needed. Otherwise fall back to a standard font.
      const bundled = matchBundledFont(`${psName ?? ''} ${styleFamily ?? ''}`)
      const cssFamily = bundled ? bundled.family : face.family

      // Pick an initial letter-spacing so the substitute font lands on the same
      // width as the original run (≈0 for a metric-compatible match).
      let letterSpacing = 0
      try {
        const natural = measureTextWidth(item.str, fontSize, cssFamily, face.bold, face.italic)
        const gaps = item.str.length - 1
        if (natural > 0 && gaps > 0) {
          const raw = (item.width - natural) / gaps
          letterSpacing = Math.max(-fontSize * 0.3, Math.min(fontSize * 0.6, raw))
        }
      } catch {
        /* measurement unavailable — leave spacing at 0 */
      }

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
        color: sampleInkColor(rect),
        opacity: 1,
        fontSize,
        fontFamily: bundled ? bundled.generic : face.family,
        bold: face.bold,
        italic: face.italic,
        letterSpacing,
        text: item.str,
        rect,
        ...(bundled ? { fontKey: bundled.key } : {})
      }
      return [cover, text]
    }

    return null
  }
}
