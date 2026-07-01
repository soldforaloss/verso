import { PDFDocument } from 'pdf-lib'

/**
 * Merges several PDFs into one, preserving page order (all of file 1, then all
 * of file 2, …). Pure — depends only on pdf-lib — so it is unit-testable without
 * the document store. Throws if a source can't be parsed (the caller surfaces
 * which file failed).
 *
 * Each source's AcroForm is flattened first: pdf-lib's `copyPages` doesn't merge
 * form field trees, so combining fillable PDFs would otherwise orphan the widgets
 * and collide on shared field names. Flattening bakes the current values into the
 * page (values kept as static text; interactivity dropped) — the safe result for
 * a merge, matching the app's own page-surgery save path.
 */
export async function combinePdfs(sources: Uint8Array[]): Promise<Uint8Array<ArrayBuffer>> {
  const out = await PDFDocument.create()
  for (const source of sources) {
    const doc = await PDFDocument.load(source)
    try {
      // Bake existing appearances (updateFieldAppearances:false avoids pdf-lib's
      // WinAnsi re-render throwing on non-Latin values); best-effort.
      doc.getForm().flatten({ updateFieldAppearances: false })
    } catch {
      /* no form, or a form that won't flatten — copy the pages as-is */
    }
    const copied = await out.copyPages(doc, doc.getPageIndices())
    for (const page of copied) out.addPage(page)
  }
  const saved = await out.save()
  const bytes = new Uint8Array(saved.length)
  bytes.set(saved)
  return bytes
}
