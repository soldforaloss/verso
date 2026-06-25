import type { TextFontFamily } from '@/lib/annotations'

/**
 * Bundled, permissively-licensed fonts used to substitute a document's font
 * when editing. Two kinds:
 *
 * - **Metric-compatible** substitutes whose glyph widths match a proprietary
 *   original exactly, so an edited run keeps the original layout:
 *   Liberation Sans ↔ Arial · Liberation Serif ↔ Times New Roman ·
 *   Liberation Mono ↔ Courier New (SIL OFL) · Carlito ↔ Calibri ·
 *   Caladea ↔ Cambria (SIL OFL).
 * - **Real open fonts** that documents use directly, so the match is the actual
 *   font: Lato (SIL OFL).
 *
 * Adding a family is data-only: the overlay, measurement, embedding-on-save, and
 * FontFace preload all read this registry.
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

function variants(prefix: string): BundledFont['files'] {
  return {
    regular: `${DIR}/${prefix}-Regular.ttf`,
    bold: `${DIR}/${prefix}-Bold.ttf`,
    italic: `${DIR}/${prefix}-Italic.ttf`,
    boldItalic: `${DIR}/${prefix}-BoldItalic.ttf`
  }
}

export const BUNDLED_FONTS: BundledFont[] = [
  { key: 'carlito', family: 'Carlito', generic: 'sans-serif', files: variants('Carlito') },
  { key: 'caladea', family: 'Caladea', generic: 'serif', files: variants('Caladea') },
  { key: 'lato', family: 'Lato', generic: 'sans-serif', files: variants('Lato') },
  {
    key: 'liberation-sans',
    family: 'Liberation Sans',
    generic: 'sans-serif',
    files: variants('LiberationSans')
  },
  {
    key: 'liberation-serif',
    family: 'Liberation Serif',
    generic: 'serif',
    files: variants('LiberationSerif')
  },
  {
    key: 'liberation-mono',
    family: 'Liberation Mono',
    generic: 'monospace',
    files: variants('LiberationMono')
  }
]

const BY_KEY = new Map(BUNDLED_FONTS.map((font) => [font.key, font]))

export function bundledFontByKey(key: string | undefined | null): BundledFont | undefined {
  return key ? BY_KEY.get(key) : undefined
}

// Document font name → bundled key. Specific names first; metric-compatible
// substitutes map their proprietary original (and the substitute's own name).
const MATCHERS: [RegExp, string][] = [
  [/calibri|carlito/, 'carlito'],
  [/cambria|caladea/, 'caladea'],
  [/lato/, 'lato'],
  [/arial|helvetica|arimo|liberation\s*sans/, 'liberation-sans'],
  [/times|tinos|liberation\s*serif/, 'liberation-serif'],
  [/courier|cousine|consol|liberation\s*mono/, 'liberation-mono']
]

/** Maps a PDF font name (PostScript name / CSS family) to a bundled font, if any. */
export function matchBundledFont(name: string | null | undefined): BundledFont | undefined {
  const n = (name ?? '').toLowerCase()
  if (!n) return undefined
  for (const [pattern, key] of MATCHERS) {
    if (pattern.test(n)) return BY_KEY.get(key)
  }
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
