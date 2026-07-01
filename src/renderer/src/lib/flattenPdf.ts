import { PDFDocument } from 'pdf-lib'

function toArrayBufferBytes(saved: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(saved.length)
  bytes.set(saved)
  return bytes
}

/**
 * Flattens a PDF's interactive AcroForm fields: each field's current value is
 * baked into the page content as static (still selectable) text/graphics and the
 * interactive widget is removed. The result is a finalized, non-editable form.
 * Text and other page content are preserved (this is not a rasterization).
 *
 * Pure — depends only on pdf-lib — so it is unit-testable without the document
 * store or pdf.js. Returns the flattened bytes and the number of fields removed
 * (0 = the document had no form fields, so it is returned structurally intact).
 */
export async function flattenPdfBytes(
  input: Uint8Array
): Promise<{ bytes: Uint8Array<ArrayBuffer>; count: number }> {
  const doc = await PDFDocument.load(input)
  const form = doc.getForm()
  const count = form.getFields().length
  // Bake the appearance streams that already exist (the build regenerated them
  // for the current values) rather than re-generating with pdf-lib's WinAnsi
  // Helvetica, which throws on non-Latin values — so international forms flatten.
  if (count > 0) form.flatten({ updateFieldAppearances: false })
  return { bytes: toArrayBufferBytes(await doc.save()), count }
}
