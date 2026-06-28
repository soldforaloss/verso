import { describe, it, expect } from 'vitest'
import { bgraToRgba } from '@/lib/pdfiumImage'

describe('bgraToRgba', () => {
  it('swaps blue and red while preserving green and alpha', () => {
    // One pixel BGRA [10,20,30,40] → RGBA [30,20,10,40].
    expect(Array.from(bgraToRgba(new Uint8Array([10, 20, 30, 40]), 1, 1))).toEqual([30, 20, 10, 40])
  })

  it('converts every pixel of a multi-pixel bitmap', () => {
    const bgra = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    expect(Array.from(bgraToRgba(bgra, 2, 1))).toEqual([3, 2, 1, 4, 7, 6, 5, 8])
  })

  it('returns an ArrayBuffer-backed array sized width*height*4', () => {
    const out = bgraToRgba(new Uint8Array(3 * 2 * 4), 3, 2)
    expect(out).toBeInstanceOf(Uint8ClampedArray)
    expect(out.length).toBe(3 * 2 * 4)
  })
})
