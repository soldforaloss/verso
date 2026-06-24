import type { TextFontFamily } from '@/lib/annotations'

/** Font face inferred from a PDF text run, used to match the cover-&-replace box. */
export interface TextFontStyle {
  family: TextFontFamily
  bold: boolean
  italic: boolean
}

/**
 * Infers a font family + weight/style from a PostScript / CSS font name (e.g.
 * "ABCDEF+Arial-BoldMT", "Times New Roman,Italic", "sans-serif"). Best-effort and
 * never throws — an unknown name falls back to a regular sans-serif face.
 */
export function fontStyleFromName(name: string | null | undefined): TextFontStyle {
  const n = (name ?? '').toLowerCase()
  const bold = /bold|black|heavy|semibold|demibold/.test(n)
  const italic = /italic|oblique/.test(n)

  // Order matters: check monospace, then sans-serif (so a literal "sans-serif"
  // is classified as sans even though it contains "serif"), then serif.
  let family: TextFontFamily = 'sans-serif'
  if (/mono|courier|consol/.test(n)) {
    family = 'monospace'
  } else if (/sans|arial|helvetica|calibri|verdana|segoe|tahoma|roboto|grotesk/.test(n)) {
    family = 'sans-serif'
  } else if (
    /times|serif|roman|georgia|garamond|minion|cambria|palatino|book ?antiqua|baskerville|caslon/.test(
      n
    )
  ) {
    family = 'serif'
  }
  return { family, bold, italic }
}

/**
 * Infers a face from a run's PostScript name and the text layer's CSS family,
 * kept as separate inputs so an embedded font's generic fallback (e.g. a serif
 * font whose CSS family ends in "sans-serif") can't flip the classification.
 * The PostScript name wins for family when it is informative; weight/style are
 * taken from whichever source carries them.
 */
export function inferTextFontStyle(
  psName: string | null | undefined,
  cssFamily: string | null | undefined
): TextFontStyle {
  const byName = fontStyleFromName(psName)
  const byCss = fontStyleFromName(cssFamily)
  return {
    family: byName.family !== 'sans-serif' ? byName.family : byCss.family,
    bold: byName.bold || byCss.bold,
    italic: byName.italic || byCss.italic
  }
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`
}

export function hexToRgbTriple(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.replace(/(.)/g, '$1$1') : value
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0
  }
}

/** Pixels nearer the background than this (squared L2 distance) are ignored. */
const INK_THRESHOLD = 1200

/**
 * Estimates the "ink" color of a text run from the rendered page pixels in its
 * bounding box, given the page background color. Each pixel is weighted by how
 * far it sits from the background, so the solid glyph cores dominate and
 * anti-aliased edges (which blend toward the background) barely count. Returns
 * null when nothing stands out from the background (e.g. a blank region).
 */
export function estimateInkColor(
  data: Uint8ClampedArray,
  background: { r: number; g: number; b: number }
): string | null {
  let wr = 0
  let wg = 0
  let wb = 0
  let weightSum = 0

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue // fully transparent
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const dr = r - background.r
    const dg = g - background.g
    const db = b - background.b
    const dist = dr * dr + dg * dg + db * db
    if (dist <= INK_THRESHOLD) continue
    const weight = dist // emphasize the purest ink
    wr += r * weight
    wg += g * weight
    wb += b * weight
    weightSum += weight
  }

  if (weightSum === 0) return null
  return rgbToHex(wr / weightSum, wg / weightSum, wb / weightSum)
}
