import type { Rect } from '@/lib/annotations'
import type { TextContentItem } from '@/lib/pdf'

/** Descender depth below the baseline, as a fraction of the font height. */
const DESCENT = 0.3
/** Ascender height above the baseline, as a fraction of the font height. Generous
 *  headroom so stacked accents / tall glyphs can't poke above the box. */
const ASCENT = 1.2

/**
 * Page-space (bottom-left origin) rect that fully covers a single text item,
 * derived from its pdf.js transform. A redaction must strictly OVER-cover — a
 * box that leaves even a sliver of the original glyphs exposed leaks after the
 * page is rasterized — so this maps the run's four glyph-box corners through the
 * full transform `[a b c d e f]` and returns their axis-aligned envelope. That
 * encloses text at ANY orientation (rotated headers, 90° sidebar labels) and any
 * vertical-flip sign (`d < 0`), and reduces to a plain padded box for ordinary
 * horizontal text. Returns null for non-text (marked-content) items or
 * degenerate geometry.
 *
 * Kept free of runtime imports (types only) so it is unit-testable without
 * pulling in pdf.js / the document store.
 */
export function redactionRectForItem(item: TextContentItem): Rect | null {
  if (!('transform' in item)) return null
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = item.transform
  const width = item.width
  const baseScale = Math.hypot(a, b) // horizontal em scale (advance direction)
  const upScale = Math.hypot(c, d) // vertical em scale (font height)
  if (!(baseScale > 0) || !(upScale > 0) || !(width > 0)) return null

  // Unit vectors along the baseline (advance) and toward the ascenders. Both are
  // taken straight from the (signed) transform, so rotation and y-flip fall out
  // naturally: the run advances along (a,b) and glyphs rise along (c,d).
  const bx = a / baseScale
  const by = b / baseScale
  const ux = c / upScale
  const uy = d / upScale
  const descent = DESCENT * upScale
  const ascent = ASCENT * upScale

  // The run's four corners in page space: [start,end] along the baseline ×
  // [descender,ascender] along the up direction.
  const corners: [number, number][] = [
    [e - ux * descent, f - uy * descent],
    [e + bx * width - ux * descent, f + by * width - uy * descent],
    [e + bx * width + ux * ascent, f + by * width + uy * ascent],
    [e + ux * ascent, f + uy * ascent]
  ]

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of corners) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const pad = Math.min(2, 0.15 * upScale)
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2
  }
}
