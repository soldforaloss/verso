import type { TextFontFamily } from '@/lib/annotations'

/**
 * Bundled, permissively-licensed fonts that are **metric-compatible** with the
 * common proprietary office fonts. Substituting a metric-compatible font keeps
 * each glyph's width identical, so an edited run lands on the original layout
 * exactly — unlike the standard-14 fonts, which have different metrics.
 *
 * - Carlito (SIL OFL 1.1) ↔ Calibri
 * - Caladea (SIL OFL 1.1) ↔ Cambria
 *
 * Arial/Times/Courier are already served well by the standard-14
 * Helvetica/Times/Courier, so only the modern Office defaults are bundled here.
 */
export interface BundledFont {
  key: string
  /** CSS / FontFace family name (also used for canvas measurement). */
  family: string
  /** Generic fallback used if the bundled file fails to load. */
  generic: TextFontFamily
  files: { regular: string; bold: string; italic: string; boldItalic: string }
}

const DIR = '/fonts'

export const BUNDLED_FONTS: BundledFont[] = [
  {
    key: 'carlito',
    family: 'Carlito',
    generic: 'sans-serif',
    files: {
      regular: `${DIR}/Carlito-Regular.ttf`,
      bold: `${DIR}/Carlito-Bold.ttf`,
      italic: `${DIR}/Carlito-Italic.ttf`,
      boldItalic: `${DIR}/Carlito-BoldItalic.ttf`
    }
  },
  {
    key: 'caladea',
    family: 'Caladea',
    generic: 'serif',
    files: {
      regular: `${DIR}/Caladea-Regular.ttf`,
      bold: `${DIR}/Caladea-Bold.ttf`,
      italic: `${DIR}/Caladea-Italic.ttf`,
      boldItalic: `${DIR}/Caladea-BoldItalic.ttf`
    }
  }
]

const BY_KEY = new Map(BUNDLED_FONTS.map((font) => [font.key, font]))

export function bundledFontByKey(key: string | undefined | null): BundledFont | undefined {
  return key ? BY_KEY.get(key) : undefined
}

/** Maps a PDF font name (PostScript name / CSS family) to a bundled font, if any. */
export function matchBundledFont(name: string | null | undefined): BundledFont | undefined {
  const n = (name ?? '').toLowerCase()
  if (/calibri|carlito/.test(n)) return BY_KEY.get('carlito')
  if (/cambria|caladea/.test(n)) return BY_KEY.get('caladea')
  return undefined
}

/** The asset URL for a bundled font's weight/style variant. */
export function bundledFontFile(font: BundledFont, bold: boolean, italic: boolean): string {
  if (bold && italic) return font.files.boldItalic
  if (bold) return font.files.bold
  if (italic) return font.files.italic
  return font.files.regular
}

/**
 * Registers every bundled face with the document via the FontFace API so the
 * edit overlay and width measurement render in the real substitute font. Safe
 * to call once at startup; failures are swallowed (the overlay then falls back
 * to a generic family).
 */
export async function preloadBundledFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined') return
  await Promise.all(
    BUNDLED_FONTS.flatMap((font) =>
      (Object.keys(font.files) as (keyof BundledFont['files'])[]).map(async (variant) => {
        const weight = variant === 'bold' || variant === 'boldItalic' ? 'bold' : 'normal'
        const style = variant === 'italic' || variant === 'boldItalic' ? 'italic' : 'normal'
        try {
          const face = new FontFace(font.family, `url(${font.files[variant]})`, { weight, style })
          document.fonts.add(await face.load())
        } catch {
          /* asset missing — generic fallback is used */
        }
      })
    )
  )
}
