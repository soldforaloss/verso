/**
 * Pixel comparison of two rendered pages. Pure (operates on raw RGBA buffers, no
 * canvas/DOM) so it is unit-testable. Produces a diff image: pixels that differ
 * beyond `threshold` are painted red; unchanged pixels are shown faded so the
 * changes stand out. Also reports the fraction of compared pixels that changed.
 */
export interface RgbaImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface DiffResult {
  /** RGBA diff image (ArrayBuffer-backed so it feeds the ImageData constructor). */
  data: Uint8ClampedArray<ArrayBuffer>
  width: number
  height: number
  /** 0–1 fraction of compared pixels that differ. */
  changedRatio: number
  /** True if the two images have different dimensions (only the overlap is compared). */
  sizeMismatch: boolean
}

const CHANGE = [255, 45, 45] as const

export function diffImages(a: RgbaImage, b: RgbaImage, threshold = 40): DiffResult {
  const width = Math.min(a.width, b.width)
  const height = Math.min(a.height, b.height)
  const out = new Uint8ClampedArray(width * height * 4)
  let changed = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ai = (y * a.width + x) * 4
      const bi = (y * b.width + x) * 4
      const oi = (y * width + x) * 4
      const delta =
        Math.abs(a.data[ai]! - b.data[bi]!) +
        Math.abs(a.data[ai + 1]! - b.data[bi + 1]!) +
        Math.abs(a.data[ai + 2]! - b.data[bi + 2]!)

      if (delta > threshold) {
        changed += 1
        out[oi] = CHANGE[0]
        out[oi + 1] = CHANGE[1]
        out[oi + 2] = CHANGE[2]
        out[oi + 3] = 255
      } else {
        // Fade the unchanged content toward white so differences pop.
        const gray = b.data[bi]! * 0.3 + b.data[bi + 1]! * 0.59 + b.data[bi + 2]! * 0.11
        const value = 235 + (gray - 235) * 0.25
        out[oi] = value
        out[oi + 1] = value
        out[oi + 2] = value
        out[oi + 3] = 255
      }
    }
  }

  return {
    data: out,
    width,
    height,
    changedRatio: width && height ? changed / (width * height) : 0,
    sizeMismatch: a.width !== b.width || a.height !== b.height
  }
}
