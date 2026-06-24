import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { applyMetadata, readMetadata, EMPTY_METADATA } from '../../src/renderer/src/lib/metadata'

async function blankPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.addPage([200, 200])
  return doc.save()
}

describe('metadata', () => {
  it('round-trips edited fields through apply → read', async () => {
    const doc = await PDFDocument.load(await blankPdf())
    applyMetadata(doc, {
      title: 'Quarterly Report',
      author: 'Ada Lovelace',
      subject: 'Finance',
      keywords: 'q1, revenue, growth',
      creator: 'Verso',
      producer: 'Verso'
    })
    const saved = await doc.save()

    const read = await readMetadata(saved)
    expect(read.title).toBe('Quarterly Report')
    expect(read.author).toBe('Ada Lovelace')
    expect(read.subject).toBe('Finance')
    expect(read.creator).toBe('Verso')
    expect(read.producer).toBe('Verso')
    // Keywords are stored as the joined PDF string; both terms survive.
    expect(read.keywords).toContain('q1')
    expect(read.keywords).toContain('growth')
    // applyMetadata stamps a modification date.
    expect(read.modificationDate).toBeInstanceOf(Date)
  })

  it('reads empty strings for a document with no Info dictionary', async () => {
    const read = await readMetadata(await blankPdf())
    expect(read.title).toBe(EMPTY_METADATA.title)
    expect(read.author).toBe('')
  })
})
