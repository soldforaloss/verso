import { describe, it, expect } from 'vitest'
import { BUNDLED_FONTS, bundledFontByKey, bundledFontFile, matchBundledFont } from '@/lib/fonts'

describe('matchBundledFont', () => {
  it('maps the MS Office defaults to their metric-compatible substitutes', () => {
    expect(matchBundledFont('Calibri')?.key).toBe('carlito')
    expect(matchBundledFont('ABCDEF+Calibri-Bold')?.key).toBe('carlito')
    expect(matchBundledFont('Cambria')?.key).toBe('caladea')
    expect(matchBundledFont('ArialMT')?.key).toBe('liberation-sans')
    expect(matchBundledFont('Helvetica')?.key).toBe('liberation-sans')
    expect(matchBundledFont('TimesNewRomanPSMT')?.key).toBe('liberation-serif')
    expect(matchBundledFont('CourierNew')?.key).toBe('liberation-mono')
  })

  it('maps a bundled font referenced by its own name', () => {
    expect(matchBundledFont('Lato-Regular')?.key).toBe('lato')
    expect(matchBundledFont('LiberationSerif')?.key).toBe('liberation-serif')
  })

  it('returns undefined for fonts we do not bundle a match for', () => {
    expect(matchBundledFont('Comic Sans MS')).toBeUndefined()
    expect(matchBundledFont('Verdana')).toBeUndefined()
    expect(matchBundledFont('')).toBeUndefined()
    expect(matchBundledFont(undefined)).toBeUndefined()
  })
})

describe('bundled font assets', () => {
  it('picks the right variant file', () => {
    const lato = bundledFontByKey('lato')!
    expect(bundledFontFile(lato, false, false)).toMatch(/Lato-Regular\.ttf$/)
    expect(bundledFontFile(lato, true, false)).toMatch(/Lato-Bold\.ttf$/)
    expect(bundledFontFile(lato, false, true)).toMatch(/Lato-Italic\.ttf$/)
    expect(bundledFontFile(lato, true, true)).toMatch(/Lato-BoldItalic\.ttf$/)
  })

  it('serves every variant from the /fonts origin path', () => {
    for (const font of BUNDLED_FONTS) {
      for (const url of Object.values(font.files)) {
        expect(url.startsWith('/fonts/')).toBe(true)
        expect(url.endsWith('.ttf')).toBe(true)
      }
    }
  })

  it('returns undefined for an unknown key', () => {
    expect(bundledFontByKey('nope')).toBeUndefined()
    expect(bundledFontByKey(undefined)).toBeUndefined()
  })
})
