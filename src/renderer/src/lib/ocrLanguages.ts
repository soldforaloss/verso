/**
 * OCR languages bundled with the app. Each maps a tesseract language code to a
 * human label. The compact `best_int` LSTM models are copied to `/tessdata` at
 * build time — keep this list in sync with `OCR_LANGS` in electron.vite.config.ts.
 *
 * Everything runs fully offline; no language data is ever fetched at runtime.
 */
export interface OcrLanguage {
  code: string
  label: string
}

export const OCR_LANGUAGES: readonly OcrLanguage[] = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'por', label: 'Portuguese' },
  { code: 'ita', label: 'Italian' },
  { code: 'nld', label: 'Dutch' },
  { code: 'rus', label: 'Russian' }
]

export const DEFAULT_OCR_LANGUAGE = 'eng'

const CODES = new Set(OCR_LANGUAGES.map((language) => language.code))

/** Returns the code if it is a bundled language, otherwise the default. */
export function normalizeOcrLanguage(code: string | undefined): string {
  return code && CODES.has(code) ? code : DEFAULT_OCR_LANGUAGE
}

export function ocrLanguageLabel(code: string): string {
  return OCR_LANGUAGES.find((language) => language.code === code)?.label ?? code
}
