import { describe, it, expect } from 'vitest'
import { BUNDLED_FONTS, bundledFontByKey, bundledFontFile, matchBundledFont } from '@/lib/fonts'

describe('matchBundledFont', () => {
  it('maps Calibri (and Carlito) to the Carlito substitute', () => {
    expect(matchBundledFont('Calibri')?.key).toBe('carlito')
    expect(matchBundledFont('ABCDEF+Calibri-Bold')?.key).toBe('carlito')
    expect(matchBundledFont('Carlito')?.key).toBe('carlito')
  })

  it('maps Cambria (and Caladea) to the Caladea substitute', () => {
    expect(matchBundledFont('Cambria')?.key).toBe('caladea')
    expect(matchBundledFont('Caladea-Italic')?.key).toBe('caladea')
  })

  it('returns undefined for fonts the standard-14 already covers', () => {
    expect(matchBundledFont('ArialMT')).toBeUndefined()
    expect(matchBundledFont('TimesNewRoman')).toBeUndefined()
    expect(matchBundledFont('')).toBeUndefined()
    expect(matchBundledFont(undefined)).toBeUndefined()
  })
})

describe('bundled font assets', () => {
  it('picks the right variant file', () => {
    const carlito = bundledFontByKey('carlito')!
    expect(bundledFontFile(carlito, false, false)).toMatch(/Carlito-Regular\.ttf$/)
    expect(bundledFontFile(carlito, true, false)).toMatch(/Carlito-Bold\.ttf$/)
    expect(bundledFontFile(carlito, false, true)).toMatch(/Carlito-Italic\.ttf$/)
    expect(bundledFontFile(carlito, true, true)).toMatch(/Carlito-BoldItalic\.ttf$/)
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
