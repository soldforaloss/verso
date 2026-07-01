import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { combinePdfs } from '../../src/renderer/src/lib/combine'

async function makePdf(
  pageCount: number,
  size: [number, number] = [300, 400]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i += 1) doc.addPage(size)
  return doc.save()
}

describe('combinePdfs', () => {
  it('merges page counts in order', async () => {
    const merged = await combinePdfs([await makePdf(2), await makePdf(3), await makePdf(1)])
    const doc = await PDFDocument.load(merged)
    expect(doc.getPageCount()).toBe(6)
  })

  it('preserves each source page size', async () => {
    const merged = await combinePdfs([await makePdf(1, [200, 200]), await makePdf(1, [612, 792])])
    const doc = await PDFDocument.load(merged)
    expect(doc.getPage(0).getSize()).toMatchObject({ width: 200, height: 200 })
    expect(doc.getPage(1).getSize()).toMatchObject({ width: 612, height: 792 })
  })

  it('handles a single source (a copy) and throws on unreadable bytes', async () => {
    expect((await PDFDocument.load(await combinePdfs([await makePdf(2)]))).getPageCount()).toBe(2)
    await expect(combinePdfs([new Uint8Array([1, 2, 3])])).rejects.toThrow()
  })

  it('flattens source form fields so the merged output has no orphaned widgets', async () => {
    // A source with an interactive text field.
    const formDoc = await PDFDocument.create()
    const page = formDoc.addPage([300, 400])
    const field = formDoc.getForm().createTextField('name')
    field.setText('Jane')
    field.addToPage(page, { x: 20, y: 20, width: 120, height: 20 })
    const withForm = await formDoc.save()

    const merged = await PDFDocument.load(await combinePdfs([withForm, await makePdf(1)]))
    expect(merged.getPageCount()).toBe(2)
    // The field was flattened during the merge — no interactive fields remain.
    expect(merged.getForm().getFields().length).toBe(0)
  })
})
