import { describe, it, expect } from 'vitest'
import {
  estimateInkColor,
  fontStyleFromName,
  hexToRgbTriple,
  inferTextFontStyle,
  rgbToHex
} from '@/lib/textStyle'

describe('fontStyleFromName', () => {
  it('detects serif faces and weight/style from a PostScript name', () => {
    expect(fontStyleFromName('ABCDEF+Times-BoldItalic')).toEqual({
      family: 'serif',
      bold: true,
      italic: true
    })
  })

  it('detects monospace', () => {
    expect(fontStyleFromName('Courier-Oblique')).toEqual({
      family: 'monospace',
      bold: false,
      italic: true
    })
  })

  it('treats Arial/Helvetica and unknown names as regular sans-serif', () => {
    expect(fontStyleFromName('ArialMT')).toEqual({
      family: 'sans-serif',
      bold: false,
      italic: false
    })
    expect(fontStyleFromName(undefined)).toEqual({
      family: 'sans-serif',
      bold: false,
      italic: false
    })
  })

  it('picks up bold from a generic sans name', () => {
    expect(fontStyleFromName('Helvetica-Bold')).toEqual({
      family: 'sans-serif',
      bold: true,
      italic: false
    })
  })
})

describe('inferTextFontStyle', () => {
  it("keeps a serif PostScript name even when the CSS fallback says 'sans-serif'", () => {
    // PDF.js sometimes appends a generic fallback; it must not flip the family.
    expect(inferTextFontStyle('TimesNewRomanPS-BoldMT', 'sans-serif')).toEqual({
      family: 'serif',
      bold: true,
      italic: false
    })
  })

  it('falls back to the CSS family when the name is an opaque id', () => {
    expect(inferTextFontStyle('g_d0_f1', 'serif')).toEqual({
      family: 'serif',
      bold: false,
      italic: false
    })
  })

  it('merges weight/style from either source', () => {
    expect(inferTextFontStyle('g_d0_f1', 'monospace')).toMatchObject({ family: 'monospace' })
    expect(inferTextFontStyle('Arial-Italic', undefined)).toMatchObject({
      family: 'sans-serif',
      italic: true
    })
  })
})

describe('rgb/hex helpers', () => {
  it('round-trips', () => {
    expect(rgbToHex(26, 63, 196)).toBe('#1a3fc4')
    expect(hexToRgbTriple('#1a3fc4')).toEqual({ r: 26, g: 63, b: 196 })
    expect(hexToRgbTriple('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })
})

describe('estimateInkColor', () => {
  // Builds an RGBA buffer: `count` ink pixels then `bgCount` background pixels.
  function buffer(
    ink: [number, number, number],
    count: number,
    bgCount: number
  ): Uint8ClampedArray {
    const data = new Uint8ClampedArray((count + bgCount) * 4)
    for (let i = 0; i < count; i += 1) {
      data.set([...ink, 255], i * 4)
    }
    for (let i = 0; i < bgCount; i += 1) {
      data.set([255, 255, 255, 255], (count + i) * 4)
    }
    return data
  }

  it('recovers a strong ink color over a white background', () => {
    const data = buffer([20, 60, 200], 30, 300) // blue text, mostly white
    const hex = estimateInkColor(data, { r: 255, g: 255, b: 255 })
    expect(hex).not.toBeNull()
    const { r, g, b } = hexToRgbTriple(hex!)
    // Clearly blue-dominant, not black, not white.
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(g)
    expect(b).toBeGreaterThan(120)
  })

  it('returns null when nothing stands out from the background', () => {
    const data = buffer([255, 255, 255], 0, 50) // all background
    expect(estimateInkColor(data, { r: 255, g: 255, b: 255 })).toBeNull()
  })
})
