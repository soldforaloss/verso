import type { SignatureImage } from '@/lib/signature'

/**
 * Longest edge (px) a picked image is downscaled to. It is placed at ~220pt and
 * lives inside the PDF as a flattened bitmap, so this keeps the embedded data
 * (and the file it saves into) sane without any visible quality loss at print
 * resolution.
 */
const MAX_DIMENSION = 3000

/** Decodes image bytes via an <img> element — the same decoder the app renders with. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The image could not be decoded.'))
    img.src = url
  })
}

/**
 * Decodes picked image bytes (PNG/JPEG), downscales an oversized image, and
 * re-encodes to a PNG data URL. Re-encoding normalizes away source quirks
 * (progressive/CMYK JPEG, colour profile) so the result always embeds via
 * pdf-lib's `embedPng` — the proven save path stamps and signatures already use.
 * Decoding goes through an `<img>` element (not `createImageBitmap`, which
 * rejects some otherwise-valid PNGs). Returns null if the bytes can't be decoded.
 */
export async function rasterizeToPng(
  bytes: Uint8Array,
  mime: string
): Promise<SignatureImage | null> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
  try {
    const img = await loadImage(url)
    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight
    if (naturalW === 0 || naturalH === 0) return null

    const longest = Math.max(naturalW, naturalH)
    const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1
    const width = Math.max(1, Math.round(naturalW * scale))
    const height = Math.max(1, Math.round(naturalH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, width, height)
    return { dataUrl: canvas.toDataURL('image/png'), width, height }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
