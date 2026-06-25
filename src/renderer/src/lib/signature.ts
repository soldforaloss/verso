/**
 * Signature helpers: load the bundled handwriting fonts (used only to render a
 * typed signature to an image — never embedded as document text), render a
 * typed signature, and trim a drawn signature to its content. The result is a
 * transparent PNG placed as an ordinary image annotation, so it moves, resizes,
 * and flattens on save like any other.
 */
export interface SignatureFont {
  key: string
  label: string
  family: string
  url: string
}

export const SIGNATURE_FONTS: SignatureFont[] = [
  {
    key: 'great-vibes',
    label: 'Elegant',
    family: 'Great Vibes',
    url: '/fonts/GreatVibes-Regular.ttf'
  },
  { key: 'caveat', label: 'Handwritten', family: 'Caveat', url: '/fonts/Caveat.ttf' }
]

/** Ink colours offered for signatures (near-black, ink blue). */
export const SIGNATURE_INKS = ['#1a1a1a', '#0a3d91'] as const

export interface SignatureImage {
  dataUrl: string
  width: number
  height: number
}

let fontsLoaded = false
export async function loadSignatureFonts(): Promise<void> {
  if (fontsLoaded || typeof document === 'undefined' || !document.fonts) return
  if (typeof FontFace === 'undefined') return
  fontsLoaded = true
  await Promise.all(
    SIGNATURE_FONTS.map(async (font) => {
      try {
        document.fonts.add(await new FontFace(font.family, `url(${font.url})`).load())
      } catch {
        /* asset missing — the preview falls back to a system cursive */
      }
    })
  )
}

/** Crops a canvas to the bounding box of its non-transparent pixels (+padding). */
export function trimToContent(canvas: HTMLCanvasElement): SignatureImage | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const { width, height } = canvas
  if (width === 0 || height === 0) return null
  const { data } = ctx.getImageData(0, 0, width, height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) return null

  const pad = 8
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(width - 1, maxX + pad)
  maxY = Math.min(height - 1, maxY + pad)
  const w = maxX - minX + 1
  const h = maxY - minY + 1

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')?.drawImage(canvas, minX, minY, w, h, 0, 0, w, h)
  return { dataUrl: out.toDataURL('image/png'), width: w, height: h }
}

const SIGNATURE_FONT_SIZE = 96

function renderWith(value: string, fontShorthand: string, color: string): SignatureImage | null {
  const measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return null
  measureCtx.font = fontShorthand
  // A generous, floored width so the glyphs always fit even if measurement is
  // unreliable (e.g. a webfont still loading on a headless runner).
  const width = Math.max(Math.ceil(measureCtx.measureText(value).width) + 60, 240)
  const height = Math.ceil(SIGNATURE_FONT_SIZE * 1.8)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = color
  ctx.font = fontShorthand
  ctx.textBaseline = 'middle'
  ctx.fillText(value, 30, height / 2)
  return trimToContent(canvas)
}

/**
 * Renders a typed name in a handwriting font to a trimmed transparent PNG.
 * Falls back to a plain sans-serif if the handwriting font produced nothing
 * (so this never yields an empty image for non-empty text).
 */
export function renderTypedSignature(
  text: string,
  family: string,
  color: string
): SignatureImage | null {
  const value = text.trim()
  if (!value) return null
  return (
    renderWith(value, `${SIGNATURE_FONT_SIZE}px "${family}", cursive`, color) ??
    renderWith(value, `${SIGNATURE_FONT_SIZE}px sans-serif`, color)
  )
}
