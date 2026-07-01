import { describe, expect, it } from 'vitest'
import { fitExtent, fitFontSize } from '../../src/renderer/src/lib/watermarkFit'

const W = 612 // US Letter
const H = 792

describe('fitExtent', () => {
  it('is half the width horizontally and half the height vertically', () => {
    expect(fitExtent(0, W, H)).toBeCloseTo(W / 2, 5)
    expect(fitExtent(90, W, H)).toBeCloseTo(H / 2, 5)
  })

  it('reaches the nearer edge on a diagonal', () => {
    // At 45° the horizontal edge is nearer on a portrait page.
    expect(fitExtent(45, W, H)).toBeCloseTo(W / 2 / Math.cos(Math.PI / 4), 3)
  })
})

describe('fitFontSize', () => {
  it('leaves the size unchanged when the text already fits', () => {
    expect(fitFontSize(60, 400, 45, W, H)).toBe(60)
  })

  it('shrinks the size proportionally when the text is too wide', () => {
    const avail = 2 * fitExtent(0, W, H) * 0.92 // horizontal available length
    const measured = avail * 2 // twice too wide
    expect(fitFontSize(60, measured, 0, W, H)).toBeCloseTo(30, 4)
  })

  it('never enlarges and never returns below 1', () => {
    expect(fitFontSize(20, 10, 0, W, H)).toBe(20)
    expect(fitFontSize(60, Number.MAX_SAFE_INTEGER, 45, W, H)).toBeGreaterThanOrEqual(1)
  })
})
