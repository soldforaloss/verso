import { describe, it, expect } from 'vitest'
import {
  OCR_LANGUAGES,
  DEFAULT_OCR_LANGUAGE,
  normalizeOcrLanguage,
  ocrLanguageLabel
} from '@/lib/ocrLanguages'

describe('ocrLanguages', () => {
  it('ships English plus a curated multi-language set', () => {
    const codes = OCR_LANGUAGES.map((l) => l.code)
    expect(codes).toContain('eng')
    expect(codes).toContain('spa')
    expect(codes).toContain('rus')
    expect(new Set(codes).size).toBe(codes.length) // no duplicates
    expect(DEFAULT_OCR_LANGUAGE).toBe('eng')
  })

  it('normalizes unknown or missing codes to the default', () => {
    expect(normalizeOcrLanguage('fra')).toBe('fra')
    expect(normalizeOcrLanguage('klingon')).toBe('eng')
    expect(normalizeOcrLanguage(undefined)).toBe('eng')
    expect(normalizeOcrLanguage('')).toBe('eng')
  })

  it('labels known codes and falls back to the raw code', () => {
    expect(ocrLanguageLabel('deu')).toBe('German')
    expect(ocrLanguageLabel('xyz')).toBe('xyz')
  })
})
