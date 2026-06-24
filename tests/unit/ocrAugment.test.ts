import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { augmentSourceWithText } from '@/lib/ocrAugment'

describe('augmentSourceWithText', () => {
  it('adds an invisible text layer and stays a valid PDF', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([300, 200])
    const original = await doc.save()

    const out = await augmentSourceWithText(
      original,
      new Map([[0, [{ text: 'Hello', x: 20, y: 100, fontSize: 14 }]]])
    )

    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(1)
    expect(out.byteLength).toBeGreaterThan(0)
  })

  it('ignores words for pages that do not exist', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([300, 200])
    const original = await doc.save()
    const out = await augmentSourceWithText(
      original,
      new Map([[5, [{ text: 'X', x: 0, y: 0, fontSize: 12 }]]])
    )
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1)
  })
})
