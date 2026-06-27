import { describe, it, expect } from 'vitest'
import { diffImages, type RgbaImage } from '@/lib/pdfCompare'

function solid(width: number, height: number, rgb: [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = rgb[0]
    data[i * 4 + 1] = rgb[1]
    data[i * 4 + 2] = rgb[2]
    data[i * 4 + 3] = 255
  }
  return { data, width, height }
}

describe('diffImages', () => {
  it('reports zero change for identical images', () => {
    const a = solid(4, 4, [255, 255, 255])
    const result = diffImages(a, solid(4, 4, [255, 255, 255]))
    expect(result.changedRatio).toBe(0)
    expect(result.sizeMismatch).toBe(false)
    expect(result.width).toBe(4)
  })

  it('reports full change for opposite images', () => {
    const result = diffImages(solid(4, 4, [255, 255, 255]), solid(4, 4, [0, 0, 0]))
    expect(result.changedRatio).toBe(1)
    // Changed pixels are painted red.
    expect([result.data[0], result.data[1], result.data[2]]).toEqual([255, 45, 45])
  })

  it('ignores sub-threshold differences', () => {
    const result = diffImages(solid(2, 2, [100, 100, 100]), solid(2, 2, [105, 105, 105]), 40)
    expect(result.changedRatio).toBe(0)
  })

  it('compares only the overlap and flags a size mismatch', () => {
    const a = solid(4, 4, [255, 255, 255])
    const b = solid(2, 2, [0, 0, 0])
    const result = diffImages(a, b)
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    expect(result.sizeMismatch).toBe(true)
    expect(result.changedRatio).toBe(1)
  })

  it('detects a single changed pixel', () => {
    const a = solid(10, 10, [255, 255, 255])
    const b = solid(10, 10, [255, 255, 255])
    // Flip one pixel in b to black.
    b.data[0] = 0
    b.data[1] = 0
    b.data[2] = 0
    const result = diffImages(a, b)
    expect(result.changedRatio).toBeCloseTo(1 / 100)
  })
})
