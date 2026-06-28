/**
 * Converts a PDFium BGRA bitmap to RGBA (the channel order a canvas `ImageData`
 * expects). Pure and unit-tested — kept free of the WASM-engine import so it can
 * be tested without loading PDFium. The only transform is swapping B and R.
 */
export function bgraToRgba(
  bgra: Uint8Array,
  width: number,
  height: number
): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = bgra[i + 2]! // R ← B
    rgba[i + 1] = bgra[i + 1]! // G
    rgba[i + 2] = bgra[i]! // B ← R
    rgba[i + 3] = bgra[i + 3]! // A
  }
  return rgba
}
