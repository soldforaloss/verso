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

/** A laid-out text run from PDF.js, in page space. */
interface Run {
  str: string
  x: number
  baseline: number
  width: number
  fontHeight: number
  fontName?: string
}

function runRect(run: Run): Rect {
  return {
    x: run.x,
    y: run.baseline - run.fontHeight * 0.25,
    width: run.width,
    height: run.fontHeight * 1.25
  }
}

/**
 * Tier 2 — pragmatic "cover & replace" editing using the annotation layer.
 *
 * Editing targets the **whole line**: the run under the click plus the
 * contiguous runs sharing its baseline are merged into one editable box, so a
 * line like "City · phone · email" edits as a single piece rather than a
 * fragment. Honest limits (the same approach mainstream consumer editors use):
 * the box takes one font/colour/size (sampled where you clicked), background and
 * ink colours come from the rendered pixels, and there is no reflow.
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

    const runs: Run[] = []
    for (const item of content.items) {
      if (!('transform' in item) || item.str === '') continue
      const t = item.transform
      runs.push({
        str: item.str,
        x: t[4],
        baseline: t[5],
        width: item.width,
        fontHeight: Math.hypot(t[2], t[3]) || 12,
        fontName: item.fontName
      })
    }

    const hit = runs.find((run) => {
      if (run.str.trim() === '') return false
      const r = runRect(run)
      return (
        point.x >= r.x && point.x <= r.x + r.width && point.y >= r.y && point.y <= r.y + r.height
      )
    })
    if (!hit) return null

    // Expand to the contiguous runs on the same baseline (a "line"). A gap wider
    // than ~1em ends the line, so separate columns/blocks are not merged in.
    const tol = hit.fontHeight * 0.4
    const line = runs
      .filter((run) => Math.abs(run.baseline - hit.baseline) <= tol)
      .sort((a, b) => a.x - b.x)
    const maxGap = hit.fontHeight
    let lo = line.indexOf(hit)
    let hi = lo
    while (lo > 0 && line[lo].x - (line[lo - 1].x + line[lo - 1].width) <= maxGap) lo -= 1
    while (hi < line.length - 1 && line[hi + 1].x - (line[hi].x + line[hi].width) <= maxGap) hi += 1
    const merged = line.slice(lo, hi + 1)

    // Reconstruct the line text, inserting a space where runs are gapped but
    // neither side already carries whitespace.
    let mergedText = ''
    for (let i = 0; i < merged.length; i += 1) {
      const run = merged[i]
      if (i > 0) {
        const prev = merged[i - 1]
        const gap = run.x - (prev.x + prev.width)
        if (gap > run.fontHeight * 0.2 && !/\s$/.test(mergedText) && !/^\s/.test(run.str)) {
          mergedText += ' '
        }
      }
      mergedText += run.str
    }

    const left = merged[0].x
    const right = Math.max(...merged.map((run) => run.x + run.width))
    const fontHeight = hit.fontHeight
    const rect: Rect = {
      x: left,
      y: hit.baseline - fontHeight * 0.25,
      width: right - left,
      height: fontHeight * 1.25
    }

    // Style comes from the clicked run (PostScript name + the text layer family).
    let psName: string | undefined
    try {
      if (hit.fontName && commonObjs?.has(hit.fontName)) psName = commonObjs.get(hit.fontName)?.name
    } catch {
      /* font not resolved yet — fall back to the style family */
    }
    const styleFamily = hit.fontName ? content.styles?.[hit.fontName]?.fontFamily : undefined
    const face = inferTextFontStyle(psName, styleFamily)
    const fontSize = Math.max(6, Math.round(fontHeight))

    // Embed a metric-compatible substitute when we have one; else a standard font.
    const bundled = matchBundledFont(`${psName ?? ''} ${styleFamily ?? ''}`)
    const cssFamily = bundled ? bundled.family : face.family

    // Letter-spacing so the substitute lands on the original line width.
    let letterSpacing = 0
    try {
      const natural = measureTextWidth(mergedText, fontSize, cssFamily, face.bold, face.italic)
      const gaps = mergedText.length - 1
      if (natural > 0 && gaps > 0) {
        const raw = (rect.width - natural) / gaps
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
      // Colour sampled where the user clicked, so it tracks that run.
      color: sampleInkColor(runRect(hit)),
      opacity: 1,
      fontSize,
      fontFamily: bundled ? bundled.generic : face.family,
      bold: face.bold,
      italic: face.italic,
      letterSpacing,
      text: mergedText,
      rect,
      ...(bundled ? { fontKey: bundled.key } : {})
    }
    return [cover, text]
  }
}
