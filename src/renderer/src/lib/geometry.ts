/** Zoom bounds and step shared by the view store and toolbar. */
export const MIN_SCALE = 0.1
export const MAX_SCALE = 8
export const ZOOM_STEP = 1.2
/** Visual gap between pages, in CSS pixels. */
export const PAGE_GAP = 16
/** Horizontal padding inside the scroll area, in CSS pixels. */
export const PAGE_MARGIN = 24

export function clampScale(scale: number): number {
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE)
}

/** A page's unscaled (scale = 1) size in CSS px, accounting for rotation. */
export interface PageSize {
  width: number
  height: number
}

/** Swaps width/height for 90°/270° rotations. */
export function rotatedSize(size: PageSize, rotation: number): PageSize {
  const normalized = ((rotation % 360) + 360) % 360
  return normalized === 90 || normalized === 270
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height }
}

/** Scale that makes a page fill the available width (minus margins). */
export function fitWidthScale(
  size: PageSize,
  rotation: number,
  containerWidth: number,
  perPageColumns = 1
): number {
  const { width } = rotatedSize(size, rotation)
  const available = containerWidth - PAGE_MARGIN * 2 - PAGE_GAP * (perPageColumns - 1)
  const target = available / perPageColumns
  return clampScale(target / width)
}

/** Scale that makes a whole page fit within the viewport. */
export function fitPageScale(
  size: PageSize,
  rotation: number,
  containerWidth: number,
  containerHeight: number
): number {
  const { width, height } = rotatedSize(size, rotation)
  const scaleX = (containerWidth - PAGE_MARGIN * 2) / width
  const scaleY = (containerHeight - PAGE_MARGIN * 2) / height
  return clampScale(Math.min(scaleX, scaleY))
}

/** Normalizes any rotation to one of 0 / 90 / 180 / 270. */
export function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  const value = (((rotation % 360) + 360) % 360) as 0 | 90 | 180 | 270
  return value
}
