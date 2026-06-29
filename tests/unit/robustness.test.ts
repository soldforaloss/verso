import { describe, it, expect } from 'vitest'
import { PDFDict, PDFDocument, PDFName, degrees } from 'pdf-lib'
import { addNewFormFields } from '@/lib/pdfFormFields'
import { addLinkAnnotations } from '@/lib/pdfLinks'
import { applyOutline } from '@/lib/pdfOutline'
import { applyMetadata } from '@/lib/metadata'
import type { NewFormField } from '@/lib/formFields'
import type { PageLink } from '@/lib/links'
import type { OutlineItem } from '@/lib/outline'

/**
 * Robustness corpus: exercises Verso's full save pipeline (the same building
 * blocks `buildFromModel` uses — copy pages, rotate, author every form-field
 * type, external + internal links, an outline, and metadata) against a spread of
 * adversarial-shaped inputs, then reloads the output and asserts it round-trips
 * intact. This is the "real PDFs break things" guard at the structural level.
 */

/** Generates the corpus: name → bytes of a deliberately awkward PDF. */
async function buildCorpus(): Promise<Record<string, Uint8Array>> {
  const corpus: Record<string, Uint8Array> = {}

  let doc = await PDFDocument.create()
  for (let i = 0; i < 250; i += 1) doc.addPage([612, 792])
  corpus['large-250-pages'] = await doc.save()

  doc = await PDFDocument.create()
  for (const r of [0, 90, 180, 270]) doc.addPage([612, 792]).setRotation(degrees(r))
  corpus['rotated-pages'] = await doc.save()

  doc = await PDFDocument.create()
  const offset = doc.addPage()
  offset.setMediaBox(100, 200, 500, 700)
  offset.setCropBox(150, 250, 300, 400)
  corpus['offset-mediabox-cropbox'] = await doc.save()

  doc = await PDFDocument.create()
  doc.addPage([3, 3])
  doc.addPage([14400, 14400])
  corpus['extreme-page-sizes'] = await doc.save()

  doc = await PDFDocument.create()
  const withForm = doc.addPage()
  const existing = doc.getForm().createTextField('preexisting')
  existing.setText('value')
  existing.addToPage(withForm, { x: 20, y: 20, width: 120, height: 18 })
  corpus['preexisting-acroform'] = await doc.save()

  doc = await PDFDocument.create()
  doc.addPage([612, 792])
  doc.addPage([792, 612])
  doc.addPage([200, 1000])
  corpus['mixed-page-sizes'] = await doc.save()

  doc = await PDFDocument.create()
  doc.addPage()
  doc.setTitle('日本語 título 😀')
  doc.setAuthor('Ünïcödé Áuthör')
  corpus['unicode-metadata'] = await doc.save()

  return corpus
}

const SAMPLE_FIELDS: NewFormField[] = [
  { id: 'f1', type: 'text', name: 'rt_text', rect: { x: 40, y: 40, width: 120, height: 18 } },
  { id: 'f2', type: 'checkbox', name: 'rt_check', rect: { x: 40, y: 70, width: 14, height: 14 } },
  {
    id: 'f3',
    type: 'dropdown',
    name: 'rt_drop',
    rect: { x: 40, y: 100, width: 120, height: 18 },
    options: ['A', 'B']
  },
  {
    id: 'f4',
    type: 'radio',
    name: 'rt_radio',
    rect: { x: 40, y: 130, width: 14, height: 40 },
    options: ['Yes', 'No']
  }
]

const SAMPLE_LINKS: PageLink[] = [
  { id: 'l1', url: 'https://example.com/path', rect: { x: 40, y: 200, width: 100, height: 16 } },
  { id: 'l2', url: '', page: 1, rect: { x: 40, y: 220, width: 100, height: 16 } }
]

/** Mirrors buildFromModel: copy + rotate every page, then layer on Verso's edits. */
async function runPipeline(sourceBytes: Uint8Array): Promise<PDFDocument> {
  const source = await PDFDocument.load(sourceBytes, { updateMetadata: false })
  const out = await PDFDocument.create()
  const pageByKey = new Map<string, ReturnType<PDFDocument['addPage']>>()
  const indices = source.getPageIndices()
  const copied = await out.copyPages(source, indices)
  copied.forEach((page, index) => {
    page.setRotation(degrees((page.getRotation().angle + 90) % 360))
    out.addPage(page)
    pageByKey.set(`p${index}`, page)
    if (index === 0) {
      addNewFormFields(out.getForm(), page, SAMPLE_FIELDS)
      addLinkAnnotations(page, SAMPLE_LINKS, (n) => out.getPages()[n - 1])
    }
  })
  const outline: OutlineItem[] = [
    { id: 'o1', title: 'Robustness ☑', pageKey: 'p0', children: [], expanded: true }
  ]
  applyOutline(out, outline, pageByKey)
  applyMetadata(out, {
    title: 'Round-trip',
    author: 'Verso',
    subject: '',
    keywords: '',
    creator: '',
    producer: ''
  })
  return PDFDocument.load(await out.save())
}

describe('save-pipeline robustness corpus', () => {
  it('round-trips every authored edit across an adversarial PDF corpus', async () => {
    const corpus = await buildCorpus()
    expect(Object.keys(corpus).length).toBeGreaterThanOrEqual(7)

    for (const [name, bytes] of Object.entries(corpus)) {
      const sourceCount = (await PDFDocument.load(bytes)).getPageCount()
      let reloaded: PDFDocument
      try {
        reloaded = await runPipeline(bytes)
      } catch (error) {
        throw new Error(`pipeline threw on "${name}": ${(error as Error).message}`, {
          cause: error
        })
      }
      // Structure preserved.
      expect(reloaded.getPageCount(), `page count for ${name}`).toBe(sourceCount)
      // Every authored field type survived onto page 1.
      const fieldNames = reloaded
        .getForm()
        .getFields()
        .map((field) => field.getName())
      for (const f of SAMPLE_FIELDS) {
        expect(fieldNames, `field ${f.name} in ${name}`).toContain(f.name)
      }
      // The outline survived.
      expect(reloaded.catalog.has(PDFName.of('Outlines')), `outline in ${name}`).toBe(true)
      // Page 1 carries at least one clickable /Link annotation.
      const annots = reloaded.getPage(0).node.Annots()
      const linkCount = annots
        ? annots
            .asArray()
            .map((ref) => reloaded.context.lookup(ref, PDFDict))
            .filter((dict) => dict.get(PDFName.of('Subtype')) === PDFName.of('Link')).length
        : 0
      expect(linkCount, `link annotations in ${name}`).toBeGreaterThanOrEqual(1)
    }
  })
})
