import {
  degrees,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts
} from 'pdf-lib'
import { getSource, useDocumentStore, type DocumentTab } from '@/store/documentStore'
import { useFormStore, type FormValue } from '@/store/formStore'
import type { PageRef } from '@/lib/pageModel'
import type { Annotation } from '@/lib/annotations'
import { drawAnnotation } from '@/lib/annotationDraw'
import { applyMetadata, type DocumentMetadata } from '@/lib/metadata'

function toArrayBufferBytes(saved: Uint8Array): Uint8Array<ArrayBuffer> {
  // pdf-lib types its output as Uint8Array<ArrayBufferLike>, which the IPC byte
  // type rejects — copy into a freshly-allocated ArrayBuffer-backed array.
  const bytes = new Uint8Array(saved.length)
  bytes.set(saved)
  return bytes
}

/** Fills a document's form fields from stored values; optionally flattens. */
async function fillForm(
  doc: PDFDocument,
  values: Record<string, FormValue>,
  flatten: boolean
): Promise<void> {
  if (Object.keys(values).length === 0) return
  const form = doc.getForm()
  for (const [name, value] of Object.entries(values)) {
    try {
      const field = form.getField(name)
      if (field instanceof PDFTextField) field.setText(typeof value === 'string' ? value : '')
      else if (field instanceof PDFCheckBox) {
        if (value) field.check()
        else field.uncheck()
      } else if (field instanceof PDFRadioGroup) {
        // The UI stores the widget's on-state (PDF.js `buttonValue`, often a
        // numeric index); map it to the pdf-lib option value.
        const options = field.getOptions()
        const stored = String(value)
        const index = Number(stored)
        const target =
          options.includes(stored) || !Number.isInteger(index) ? stored : (options[index] ?? stored)
        field.select(target)
      } else if (field instanceof PDFDropdown) field.select(String(value))
      else if (field instanceof PDFOptionList)
        field.select(Array.isArray(value) ? value : [String(value)])
    } catch {
      // Field missing or type mismatch — skip it (best effort).
    }
  }
  try {
    form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica))
  } catch {
    /* some forms lack appearance dicts; ignore */
  }
  if (flatten) {
    try {
      form.flatten()
    } catch {
      /* flatten can throw on malformed forms; values are still set */
    }
  }
}

/**
 * Builds a PDF by rebuilding from the page model: source pages are copied via
 * pdf-lib (rotation composed), blanks created, annotations and forms flattened.
 * Used for subsets (extract/split) and any document that has been restructured
 * (reordered/merged/blanks). Form fields cannot survive `copyPages`, so they are
 * filled and flattened here.
 */
async function buildFromModel(
  pages: PageRef[],
  annotationsByKey: Record<string, Annotation[]>,
  formValuesBySource: Record<string, Record<string, FormValue>>,
  metadata: DocumentMetadata | null
): Promise<Uint8Array<ArrayBuffer>> {
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const sourceDocs = new Map<string, PDFDocument>()

  const sourceDoc = async (sourceId: string): Promise<PDFDocument> => {
    const cached = sourceDocs.get(sourceId)
    if (cached) return cached
    const source = getSource(sourceId)
    if (!source) throw new Error('A source document is no longer available.')
    const doc = await PDFDocument.load(source.bytes, { updateMetadata: false })
    await fillForm(doc, formValuesBySource[sourceId] ?? {}, true)
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
      copied.setRotation(degrees((copied.getRotation().angle + ref.rotation) % 360))
      out.addPage(copied)
      page = copied
    }
    for (const annotation of annotationsByKey[ref.key] ?? []) {
      await drawAnnotation(out, page, font, annotation)
    }
  }

  if (metadata) applyMetadata(out, metadata)
  return toArrayBufferBytes(await out.save())
}

/**
 * A "pristine" tab references a single source 1:1 in original order. Returns its
 * source id, or null if the document has been restructured.
 */
function pristineSourceId(tab: DocumentTab): string | null {
  if (tab.sourceIds.length !== 1) return null
  const sourceId = tab.sourceIds[0]!
  const source = getSource(sourceId)
  if (!source || tab.pages.length !== source.pdf.numPages) return null
  const ok = tab.pages.every(
    (ref, index) => ref.kind === 'source' && ref.sourceId === sourceId && ref.sourceIndex === index
  )
  return ok ? sourceId : null
}

/**
 * Saves a pristine document in place: form fields stay **editable** (filled, not
 * flattened) and the original structure (links, outline) is preserved. Page
 * rotations and annotations are applied/flattened.
 */
async function buildPristine(
  tab: DocumentTab,
  sourceId: string,
  formValues: Record<string, FormValue>
): Promise<Uint8Array<ArrayBuffer>> {
  const source = getSource(sourceId)!
  const doc = await PDFDocument.load(source.bytes, { updateMetadata: false })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  await fillForm(doc, formValues, false)

  const pages = doc.getPages()
  for (let index = 0; index < tab.pages.length; index += 1) {
    const ref = tab.pages[index]!
    const page = pages[index]
    if (!page) continue
    if (ref.rotation) page.setRotation(degrees((page.getRotation().angle + ref.rotation) % 360))
    for (const annotation of tab.annotations[ref.key] ?? []) {
      await drawAnnotation(doc, page, font, annotation)
    }
  }

  if (tab.metadata) applyMetadata(doc, tab.metadata)
  return toArrayBufferBytes(await doc.save())
}

/** Materializes the document, choosing the pristine or rebuild path. */
async function buildDocumentBytes(tab: DocumentTab): Promise<Uint8Array<ArrayBuffer>> {
  const formValues = formValuesForTab(tab)
  const sourceId = pristineSourceId(tab)
  if (sourceId) return buildPristine(tab, sourceId, formValues[sourceId] ?? {})
  return buildFromModel(tab.pages, tab.annotations, formValues, tab.metadata)
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

/** Collects filled form values for every source the tab references. */
function formValuesForTab(tab: DocumentTab): Record<string, Record<string, FormValue>> {
  const store = useFormStore.getState()
  const map: Record<string, Record<string, FormValue>> = {}
  for (const sourceId of tab.sourceIds) map[sourceId] = store.valuesForSource(sourceId)
  return map
}

/** Materializes the whole document (used for save and e2e verification). */
export function buildDocumentPdf(tab: DocumentTab): Promise<Uint8Array> {
  return buildDocumentBytes(tab)
}

/** Saves the document, prompting for a path on Save As or first save. */
export async function saveDocument(tab: DocumentTab, saveAs = false): Promise<boolean> {
  const bytes = await buildDocumentBytes(tab)
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
  const bytes = await buildFromModel(subset, tab.annotations, formValuesForTab(tab), tab.metadata)
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
  const formValues = formValuesForTab(tab)
  for (let index = 0; index < tab.pages.length; index += 1) {
    const bytes = await buildFromModel(
      [tab.pages[index]!],
      tab.annotations,
      formValues,
      tab.metadata
    )
    const name = `${base}-${String(index + 1).padStart(3, '0')}.pdf`
    await window.api.writeFileInDir({ dir, name, bytes })
    count += 1
  }
  return count
}
