import { describe, it, expect } from 'vitest'
import { StandardFonts } from 'pdf-lib'
import { standardFontFor } from '@/lib/annotationDraw'

describe('standardFontFor', () => {
  it('maps sans-serif weights/styles to Helvetica variants', () => {
    expect(standardFontFor('sans-serif', false, false)).toBe(StandardFonts.Helvetica)
    expect(standardFontFor('sans-serif', true, false)).toBe(StandardFonts.HelveticaBold)
    expect(standardFontFor('sans-serif', false, true)).toBe(StandardFonts.HelveticaOblique)
    expect(standardFontFor('sans-serif', true, true)).toBe(StandardFonts.HelveticaBoldOblique)
  })

  it('maps serif to Times and monospace to Courier', () => {
    expect(standardFontFor('serif', false, false)).toBe(StandardFonts.TimesRoman)
    expect(standardFontFor('serif', true, true)).toBe(StandardFonts.TimesRomanBoldItalic)
    expect(standardFontFor('monospace', false, false)).toBe(StandardFonts.Courier)
    expect(standardFontFor('monospace', true, false)).toBe(StandardFonts.CourierBold)
  })
})
