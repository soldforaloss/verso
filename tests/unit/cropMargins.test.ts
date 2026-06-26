import { describe, it, expect } from 'vitest'
import { cropFromMargins } from '@/lib/pageModel'

const letter = { width: 612, height: 792 }

describe('cropFromMargins', () => {
  it('returns the full page for zero margins', () => {
    expect(cropFromMargins(letter, { top: 0, right: 0, bottom: 0, left: 0 })).toEqual({
      x: 0,
      y: 0,
      width: 612,
      height: 792
    })
  })

  it('trims each edge (origin bottom-left)', () => {
    // 10% left, 20% right, 25% top, 5% bottom.
    const crop = cropFromMargins(letter, { top: 0.25, right: 0.2, bottom: 0.05, left: 0.1 })
    expect(crop.x).toBeCloseTo(61.2)
    expect(crop.y).toBeCloseTo(39.6)
    expect(crop.width).toBeCloseTo(612 * 0.7)
    expect(crop.height).toBeCloseTo(792 * 0.7)
  })

  it('clamps to a 1×1 minimum for extreme margins', () => {
    const crop = cropFromMargins(letter, { top: 0.9, right: 0.9, bottom: 0.9, left: 0.9 })
    expect(crop.width).toBe(1)
    expect(crop.height).toBe(1)
  })
})
