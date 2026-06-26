import { describe, it, expect } from 'vitest'
import { PDFArray, PDFDocument, PDFDict, PDFHexString, PDFName, PDFNumber } from 'pdf-lib'
import { applyOutline } from '@/lib/pdfOutline'
import type { OutlineItem } from '@/lib/outline'

async function makeDoc(pageCount: number): Promise<{ doc: PDFDocument; keys: string[] }> {
  const doc = await PDFDocument.create()
  const keys: string[] = []
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage([200, 300])
    keys.push(`k${i}`)
  }
  return { doc, keys }
}

function pageByKey(
  doc: PDFDocument,
  keys: string[]
): Map<string, ReturnType<PDFDocument['getPage']>> {
  const map = new Map<string, ReturnType<PDFDocument['getPage']>>()
  doc.getPages().forEach((page, i) => map.set(keys[i]!, page))
  return map
}

const title = (dict: PDFDict): string =>
  (dict.lookup(PDFName.of('Title'), PDFHexString) as PDFHexString).decodeText()
const count = (dict: PDFDict): number =>
  (dict.lookup(PDFName.of('Count'), PDFNumber) as PDFNumber).asNumber()

describe('applyOutline (pdf-lib /Outlines writer)', () => {
  it('writes a nested outline with correct titles, links, and signed counts', async () => {
    const { doc, keys } = await makeDoc(3)
    const tree: OutlineItem[] = [
      {
        id: 'a',
        title: 'Chapter 1',
        pageKey: 'k0',
        expanded: true,
        children: [{ id: 'b', title: 'Section 1.1', pageKey: 'k1', expanded: true, children: [] }]
      },
      { id: 'c', title: 'Chapter 2', pageKey: 'k2', expanded: true, children: [] }
    ]
    applyOutline(doc, tree, pageByKey(doc, keys))

    // Persist + reload to prove it survives serialization.
    const reloaded = await PDFDocument.load(await doc.save())
    const outlines = reloaded.catalog.lookup(PDFName.of('Outlines'), PDFDict)
    expect(count(outlines)).toBe(3) // Chapter 1, Section 1.1, Chapter 2 all visible

    const ch1 = outlines.lookup(PDFName.of('First'), PDFDict)
    expect(title(ch1)).toBe('Chapter 1')
    expect(count(ch1)).toBe(1) // expanded, one visible descendant
    expect(ch1.has(PDFName.of('Dest'))).toBe(true)

    const sec = ch1.lookup(PDFName.of('First'), PDFDict)
    expect(title(sec)).toBe('Section 1.1')
    expect(sec.has(PDFName.of('First'))).toBe(false) // leaf: no children
    expect(sec.has(PDFName.of('Count'))).toBe(false) // leaf: no /Count

    const ch2 = ch1.lookup(PDFName.of('Next'), PDFDict)
    expect(title(ch2)).toBe('Chapter 2')
    expect(ch2.has(PDFName.of('Next'))).toBe(false) // last sibling
    const last = outlines.lookup(PDFName.of('Last'), PDFDict)
    expect(title(last)).toBe('Chapter 2')
  })

  it('uses a negative /Count for a collapsed parent', async () => {
    const { doc, keys } = await makeDoc(2)
    const tree: OutlineItem[] = [
      {
        id: 'a',
        title: 'Closed',
        pageKey: 'k0',
        expanded: false,
        children: [{ id: 'b', title: 'Hidden', pageKey: 'k1', expanded: true, children: [] }]
      }
    ]
    applyOutline(doc, tree, pageByKey(doc, keys))
    const outlines = doc.catalog.lookup(PDFName.of('Outlines'), PDFDict)
    expect(count(outlines)).toBe(1) // only the collapsed parent is visible
    const closed = outlines.lookup(PDFName.of('First'), PDFDict)
    expect(count(closed)).toBe(-1) // collapsed: negative immediate-child count
  })

  it('omits /Dest for items whose page key does not resolve', async () => {
    const { doc, keys } = await makeDoc(1)
    const tree: OutlineItem[] = [
      { id: 'a', title: 'Header', pageKey: 'missing', expanded: true, children: [] }
    ]
    applyOutline(doc, tree, pageByKey(doc, keys))
    const header = doc.catalog
      .lookup(PDFName.of('Outlines'), PDFDict)
      .lookup(PDFName.of('First'), PDFDict)
    expect(header.has(PDFName.of('Dest'))).toBe(false)
    expect(title(header)).toBe('Header')
  })

  it('removes /Outlines for an empty tree', async () => {
    const { doc, keys } = await makeDoc(1)
    applyOutline(doc, [], pageByKey(doc, keys))
    expect(doc.catalog.has(PDFName.of('Outlines'))).toBe(false)
  })

  it('frees the previous outline on overwrite instead of orphaning it', async () => {
    // Build a doc with outline A and reload so A is a parsed indirect-object tree.
    const { doc, keys } = await makeDoc(2)
    applyOutline(
      doc,
      [{ id: 'a', title: 'OLD', pageKey: 'k0', expanded: true, children: [] }],
      pageByKey(doc, keys)
    )
    const withA = await PDFDocument.load(await doc.save())
    const countA = withA.context.enumerateIndirectObjects().length

    // Overwrite with outline B and reload.
    applyOutline(
      withA,
      [{ id: 'b', title: 'NEW', pageKey: 'k0', expanded: true, children: [] }],
      pageByKey(withA, ['k0', 'k1'])
    )
    const withB = await PDFDocument.load(await withA.save())

    // No net object growth — the old tree was freed, not orphaned.
    expect(withB.context.enumerateIndirectObjects().length).toBeLessThanOrEqual(countA)
    // And only the new outline is reachable.
    const outlines = withB.catalog.lookup(PDFName.of('Outlines'), PDFDict)
    expect(title(outlines.lookup(PDFName.of('First'), PDFDict))).toBe('NEW')
  })

  it('anchors the destination to the page box origin (non-zero MediaBox)', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([400, 600])
    page.setMediaBox(10, 20, 400, 600) // origin (10, 20), size 400x600
    applyOutline(
      doc,
      [{ id: 'a', title: 'Top', pageKey: 'k0', expanded: true, children: [] }],
      new Map([['k0', page]])
    )
    const dest = doc.catalog
      .lookup(PDFName.of('Outlines'), PDFDict)
      .lookup(PDFName.of('First'), PDFDict)
      .lookup(PDFName.of('Dest'), PDFArray)
    expect((dest.lookup(2, PDFNumber) as PDFNumber).asNumber()).toBe(10) // left = box.x
    expect((dest.lookup(3, PDFNumber) as PDFNumber).asNumber()).toBe(620) // top = box.y + height
  })
})
