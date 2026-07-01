/**
 * Half the length available from the page centre along a line at `angle`
 * (degrees) before it exits a `w × h` rectangle. For a horizontal line this is
 * `w/2`; for a vertical line `h/2`; for a diagonal it's whichever edge the line
 * reaches first. Pure — used to keep a rotated watermark inside the page.
 */
export function fitExtent(angle: number, w: number, h: number): number {
  const rad = (angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return Math.min(cos > 1e-3 ? w / 2 / cos : Infinity, sin > 1e-3 ? h / 2 / sin : Infinity)
}

/**
 * Shrinks `fontSize` so text `measuredWidth` wide fits (with a small margin)
 * along a line at `angle` centred in a `w × h` page — never enlarges. Returns
 * the original size when it already fits.
 */
export function fitFontSize(
  fontSize: number,
  measuredWidth: number,
  angle: number,
  w: number,
  h: number
): number {
  const available = 2 * fitExtent(angle, w, h) * 0.92
  if (!(measuredWidth > available) || measuredWidth <= 0) return fontSize
  return Math.max(1, (fontSize * available) / measuredWidth)
}
