import { degrees, PDFDocument, StandardFonts } from 'pdf-lib'
import { getSource, useDocumentStore, type DocumentTab } from '@/store/documentStore'
import type { PageRef } from '@/lib/pageModel'
import type { Annotation } from '@/lib/annotations'
import { drawAnnotation } from '@/lib/annotationDraw'

/**
 * Builds a valid PDF from a list of logical page descriptors. Source pages are
 * copied from their original bytes via pdf-lib (rotation composed); blank pages
 * are created fresh; annotations are flattened into each page's content. This
 * is the only place the page model is materialized into real PDF bytes.
 */
async function buildPdf(
  pages: PageRef[],
  annotationsByKey: Record<string, Annotation[]> = {}
): Promise<Uint8Array<ArrayBuffer>> {
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const sourceDocs = new Map<string, PDFDocument>()

  const sourceDoc = async (sourceId: string): Promise<PDFDocument> => {
    const cached = sourceDocs.get(sourceId)
    if (cached) return cached
    const source = getSource(sourceId)
    if (!source) throw new Error('A source document is no longer available.')
    const doc = await PDFDocument.load(source.bytes)
    sourceDocs.set(sourceId, doc)
    return doc
  }

  for (const ref of pages) {
    let page
    if (ref.kind === 'blank') {
      page = out.addPage([ref.width, ref.height])
      if (ref.rotation) page.setRotation(degrees(ref.rotation))
    } else {
      const doc = await sourceDoc(ref.sourceId)
      const [copied] = await out.copyPages(doc, [ref.sourceIndex])
      if (!copied) continue
      const intrinsic = copied.getRotation().angle
      copied.setRotation(degrees((intrinsic + ref.rotation) % 360))
      out.addPage(copied)
      page = copied
    }
    for (const annotation of annotationsByKey[ref.key] ?? []) {
      drawAnnotation(page, font, annotation)
    }
  }

  // Copy into a freshly-allocated ArrayBuffer-backed array (pdf-lib types its
  // output as Uint8Array<ArrayBufferLike>, which the IPC byte type rejects).
  const saved = await out.save()
  const bytes = new Uint8Array(saved.length)
  bytes.set(saved)
  return bytes
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

function stripPdfExt(name: string): string {
  return name.replace(/\.pdf$/i, '')
}

function withPdfExt(name: string): string {
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`
}

/** Materializes the whole document (used for save and e2e verification). */
export function buildDocumentPdf(tab: DocumentTab): Promise<Uint8Array> {
  return buildPdf(tab.pages, tab.annotations)
}

/** Saves the document, prompting for a path on Save As or first save. */
export async function saveDocument(tab: DocumentTab, saveAs = false): Promise<boolean> {
  const bytes = await buildPdf(tab.pages, tab.annotations)
  let path = tab.path
  if (saveAs || !path) {
    path = await window.api.showSaveDialog({ defaultName: withPdfExt(tab.name) })
    if (!path) return false
  }
  await window.api.writeFile({ path, bytes })
  useDocumentStore.getState().markSaved(tab.id, path, baseName(path))
  return true
}

/** Exports the given page indices to a new PDF (Save As). */
export async function extractPages(tab: DocumentTab, indices: number[]): Promise<boolean> {
  const subset = indices
    .slice()
    .sort((a, b) => a - b)
    .map((index) => tab.pages[index])
    .filter((page): page is PageRef => Boolean(page))
  if (subset.length === 0) return false
  const bytes = await buildPdf(subset, tab.annotations)
  const path = await window.api.showSaveDialog({
    defaultName: `${stripPdfExt(tab.name)}-extract.pdf`
  })
  if (!path) return false
  await window.api.writeFile({ path, bytes })
  return true
}

/** Splits the document into one PDF per page inside a chosen folder. */
export async function splitDocument(tab: DocumentTab): Promise<number> {
  const dir = await window.api.selectDirectory()
  if (!dir) return 0
  const base = stripPdfExt(tab.name)
  let count = 0
  for (let index = 0; index < tab.pages.length; index += 1) {
    const bytes = await buildPdf([tab.pages[index]!], tab.annotations)
    const name = `${base}-${String(index + 1).padStart(3, '0')}.pdf`
    await window.api.writeFileInDir({ dir, name, bytes })
    count += 1
  }
  return count
}
