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
