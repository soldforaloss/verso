import { describe, it, expect } from 'vitest'
import {
  clampScale,
  fitPageScale,
  fitWidthScale,
  MAX_SCALE,
  MIN_SCALE,
  normalizeRotation,
  PAGE_MARGIN,
  rotatedSize
} from '@/lib/geometry'

describe('geometry', () => {
  describe('clampScale', () => {
    it('clamps above the maximum', () => {
      expect(clampScale(1000)).toBe(MAX_SCALE)
    })
    it('clamps below the minimum', () => {
      expect(clampScale(0.0001)).toBe(MIN_SCALE)
    })
    it('passes through in-range values', () => {
      expect(clampScale(1.5)).toBe(1.5)
    })
  })

  describe('rotatedSize', () => {
    const size = { width: 600, height: 800 }
    it('keeps dimensions for 0° and 180°', () => {
      expect(rotatedSize(size, 0)).toEqual(size)
      expect(rotatedSize(size, 180)).toEqual(size)
    })
    it('swaps dimensions for 90° and 270°', () => {
      expect(rotatedSize(size, 90)).toEqual({ width: 800, height: 600 })
      expect(rotatedSize(size, 270)).toEqual({ width: 800, height: 600 })
    })
    it('handles negative/over-360 rotations', () => {
      expect(rotatedSize(size, -90)).toEqual({ width: 800, height: 600 })
      expect(rotatedSize(size, 450)).toEqual({ width: 800, height: 600 })
    })
  })

  describe('normalizeRotation', () => {
    it('wraps into 0/90/180/270', () => {
      expect(normalizeRotation(360)).toBe(0)
      expect(normalizeRotation(-90)).toBe(270)
      expect(normalizeRotation(450)).toBe(90)
    })
  })

  describe('fitWidthScale', () => {
    it('fills the available width for a single column', () => {
      const size = { width: 600, height: 800 }
      const containerWidth = 600 + PAGE_MARGIN * 2 // available width == page width
      expect(fitWidthScale(size, 0, containerWidth, 1)).toBeCloseTo(1, 5)
    })
    it('accounts for rotation swapping width/height', () => {
      const size = { width: 400, height: 800 }
      const containerWidth = 800 + PAGE_MARGIN * 2 // rotated width is 800
      expect(fitWidthScale(size, 90, containerWidth, 1)).toBeCloseTo(1, 5)
    })
  })

  describe('fitPageScale', () => {
    it('fits the limiting dimension within the viewport', () => {
      const size = { width: 600, height: 800 }
      const containerWidth = 600 + PAGE_MARGIN * 2
      const containerHeight = 1600 + PAGE_MARGIN * 2 // height is generous → width-limited
      expect(fitPageScale(size, 0, containerWidth, containerHeight)).toBeCloseTo(1, 5)
    })
  })
})
