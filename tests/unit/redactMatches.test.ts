import { describe, expect, it } from 'vitest'
import { redactionRectForItem } from '../../src/renderer/src/lib/redactionGeometry'
import type { Rect } from '../../src/renderer/src/lib/annotations'
import type { TextContentItem } from '../../src/renderer/src/lib/pdf'

/** A minimal pdf.js TextItem stand-in (only the fields the helper reads). */
function item(transform: number[], width: number): TextContentItem {
  return { str: 'x', transform, width, height: transform[3] } as unknown as TextContentItem
}

const contains = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height

describe('redactionRectForItem', () => {
  it('over-covers a horizontal run (baseline ends, descenders, ascenders)', () => {
    const r = redactionRectForItem(item([12, 0, 0, 12, 100, 700], 50))!
    expect(contains(r, 100, 700)).toBe(true) // baseline start
    expect(contains(r, 150, 700)).toBe(true) // baseline end
    expect(contains(r, 125, 700 - 2)).toBe(true) // a descender below the baseline
    expect(contains(r, 125, 700 + 12)).toBe(true) // an ascender near the em top
    // It encloses, but doesn't balloon absurdly.
    expect(r.width).toBeGreaterThanOrEqual(50)
    expect(r.width).toBeLessThan(60)
  })

  it('encloses a 90°-rotated run whose glyphs advance vertically (anti-leak)', () => {
    // Advance is +y (b=12), up direction is -x. The run spans (100,700)→(100,750).
    const r = redactionRectForItem(item([0, 12, -12, 0, 100, 700], 50))!
    expect(contains(r, 100, 700)).toBe(true)
    expect(contains(r, 100, 750)).toBe(true) // far end — the old axis-aligned box missed this
    expect(r.height).toBeGreaterThanOrEqual(50)
  })

  it('encloses a 45°-rotated run diagonally', () => {
    const s = 12 / Math.SQRT2 // a=b=cos45·12
    const r = redactionRectForItem(item([s, s, -s, s, 100, 700], 50))!
    const endX = 100 + (s / 12) * 50
    const endY = 700 + (s / 12) * 50
    expect(contains(r, 100, 700)).toBe(true)
    expect(contains(r, endX, endY)).toBe(true)
  })

  it('covers a vertically-flipped run (d < 0) whose glyphs render BELOW the baseline', () => {
    // Up direction is -y, so glyphs sit under y=700; the box must extend downward.
    const r = redactionRectForItem(item([12, 0, 0, -12, 100, 700], 50))!
    expect(r.y).toBeLessThan(700)
    expect(contains(r, 125, 700 - 10)).toBe(true)
  })

  it('returns null for a marked-content item (no transform)', () => {
    expect(redactionRectForItem({ type: 'beginMarkedContent' } as unknown as TextContentItem)).toBe(
      null
    )
  })

  it('returns null for degenerate geometry (zero width or scale)', () => {
    expect(redactionRectForItem(item([12, 0, 0, 12, 10, 10], 0))).toBeNull()
    expect(redactionRectForItem(item([0, 0, 0, 0, 10, 10], 30))).toBeNull()
  })
})
