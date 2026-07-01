import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { flattenPdfBytes } from '../../src/renderer/src/lib/flattenPdf'

async function makeFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  const form = doc.getForm()
  const text = form.createTextField('name')
  text.setText('Jane Doe')
  text.addToPage(page, { x: 40, y: 200, width: 200, height: 24 })
  const check = form.createCheckBox('agree')
  check.check()
  check.addToPage(page, { x: 40, y: 160, width: 16, height: 16 })
  return doc.save()
}

describe('flattenPdfBytes', () => {
  it('removes every interactive field and reports the count', async () => {
    const input = await makeFormPdf()
    expect((await PDFDocument.load(input)).getForm().getFields().length).toBe(2)

    const { bytes, count } = await flattenPdfBytes(input)
    expect(count).toBe(2)
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getForm().getFields().length).toBe(0)
    // The page (and its now-baked content) is preserved.
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('is a structural no-op (count 0) for a document with no form fields', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([200, 200])
    const { bytes, count } = await flattenPdfBytes(await doc.save())
    expect(count).toBe(0)
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })

  it('leaves the input bytes unmodified (works on a copy)', async () => {
    const input = await makeFormPdf()
    const before = input.slice()
    await flattenPdfBytes(input)
    expect(Array.from(input)).toEqual(Array.from(before))
  })
})
