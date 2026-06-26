/** A rotation applied to a page, in degrees. */
export type Rotation = 0 | 90 | 180 | 270

/** A crop rectangle in unrotated PDF point space (origin bottom-left). */
export interface CropBox {
  x: number
  y: number
  width: number
  height: number
}

/** A logical page backed by a page in a loaded source PDF. */
export interface SourcePageRef {
  key: string
  kind: 'source'
  sourceId: string
  /** 0-based page index within the source document. */
  sourceIndex: number
  /** User-applied rotation, composed with the page's intrinsic rotation. */
  rotation: Rotation
  crop?: CropBox | null
}

/** A logical blank page inserted by the user. */
export interface BlankPageRef {
  key: string
  kind: 'blank'
  width: number
  height: number
  rotation: Rotation
}

export type PageRef = SourcePageRef | BlankPageRef

/** Generates a stable key for a new page descriptor. */
export function pageKey(): string {
  return crypto.randomUUID()
}

export function addRotation(current: Rotation, delta: number): Rotation {
  return ((((current + delta) % 360) + 360) % 360) as Rotation
}

/** Trim fractions (0–1) off each edge of the page. */
export interface CropMargins {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * Builds a crop box (unrotated PDF point space, origin bottom-left) by trimming
 * the given fractional margins off each edge of a page of `size`. Always returns
 * at least a 1×1 box, even for extreme margins.
 */
export function cropFromMargins(
  size: { width: number; height: number },
  margins: CropMargins
): CropBox {
  const left = Math.min(Math.max(margins.left, 0), 1)
  const right = Math.min(Math.max(margins.right, 0), 1)
  const top = Math.min(Math.max(margins.top, 0), 1)
  const bottom = Math.min(Math.max(margins.bottom, 0), 1)
  return {
    x: left * size.width,
    y: bottom * size.height,
    width: Math.max(1, (1 - left - right) * size.width),
    height: Math.max(1, (1 - top - bottom) * size.height)
  }
}
