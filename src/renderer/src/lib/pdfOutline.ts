import {
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  type PDFDocument,
  type PDFPage
} from 'pdf-lib'
import { countVisible, type OutlineItem } from '@/lib/outline'

/**
 * Removes a document's existing `/Outlines` tree from the context so the dead
 * objects aren't re-serialized (pdf-lib does no garbage collection on save).
 * Walks the linked list defensively (visited-guard + bounded) against malformed
 * or cyclic source outlines.
 */
function freeExistingOutline(doc: PDFDocument): void {
  const catalog = doc.catalog
  const rootRef = catalog.get(PDFName.of('Outlines'))
  if (!(rootRef instanceof PDFRef)) return
  const ctx = doc.context
  const seen = new Set<string>()
  let budget = 100_000

  const visit = (ref: unknown): void => {
    if (budget-- <= 0 || !(ref instanceof PDFRef)) return
    const key = `${ref.objectNumber} ${ref.generationNumber}`
    if (seen.has(key)) return
    seen.add(key)
    const dict = ctx.lookup(ref)
    ctx.delete(ref)
    if (dict instanceof PDFDict) {
      visit(dict.get(PDFName.of('First')))
      visit(dict.get(PDFName.of('Next')))
    }
  }

  visit(rootRef)
}

/**
 * Writes a bookmark tree into `doc` as a `/Outlines` structure, replacing any
 * outline already present. pdf-lib (1.17.1) has no high-level outline API, so
 * this builds the dictionary tree by hand:
 *  - refs are pre-allocated with `nextRef()` to resolve the sibling/parent/child
 *    cross-references, then filled with `assign()`;
 *  - siblings are linked with `/Prev` and `/Next`, parents with `/First`/`/Last`;
 *  - `/Count` is computed manually with the signed convention (positive = visible
 *    descendants when open, negative = immediate children when collapsed, omitted
 *    on leaves) since pdf-lib does not compute it;
 *  - titles are written as UTF-16BE (`PDFHexString.fromText`) so Unicode survives
 *    — a bare string would be coerced to a `/Name`.
 *
 * Destinations target the pdf-lib page resolved from each item's `pageKey` via
 * `pageByKey`; items whose key doesn't resolve become non-navigating headers
 * (no `/Dest`). An empty tree removes `/Outlines` entirely.
 */
export function applyOutline(
  doc: PDFDocument,
  items: OutlineItem[],
  pageByKey: Map<string, PDFPage>
): void {
  const catalog = doc.catalog
  // Free any pre-existing outline first so it isn't left as dead, re-serialized
  // objects (pdf-lib doesn't garbage-collect on save).
  freeExistingOutline(doc)
  if (items.length === 0) {
    catalog.delete(PDFName.of('Outlines'))
    return
  }

  const ctx = doc.context

  const build = (siblings: OutlineItem[], parentRef: PDFRef): { first: PDFRef; last: PDFRef } => {
    const refs = siblings.map(() => ctx.nextRef())
    siblings.forEach((item, index) => {
      const dict = PDFDict.withContext(ctx)
      dict.set(PDFName.of('Title'), PDFHexString.fromText(item.title))
      dict.set(PDFName.of('Parent'), parentRef)

      const prev = refs[index - 1]
      const next = refs[index + 1]
      if (prev) dict.set(PDFName.of('Prev'), prev)
      if (next) dict.set(PDFName.of('Next'), next)

      const page = item.pageKey ? pageByKey.get(item.pageKey) : undefined
      if (page) {
        // [pageRef /XYZ left top zoom] — top-left of the page box, retaining
        // zoom. Use the MediaBox so a non-(0,0) origin still lands at the top.
        const box = page.getMediaBox()
        dict.set(PDFName.of('Dest'), ctx.obj([page.ref, 'XYZ', box.x, box.y + box.height, null]))
      }

      if (item.children.length > 0) {
        const child = build(item.children, refs[index]!)
        dict.set(PDFName.of('First'), child.first)
        dict.set(PDFName.of('Last'), child.last)
        const count = item.expanded ? countVisible(item.children) : -item.children.length
        dict.set(PDFName.of('Count'), PDFNumber.of(count))
      }

      ctx.assign(refs[index]!, dict)
    })
    return { first: refs[0]!, last: refs[refs.length - 1]! }
  }

  const outlinesRef = ctx.nextRef()
  const { first, last } = build(items, outlinesRef)

  const outlines = PDFDict.withContext(ctx)
  outlines.set(PDFName.of('Type'), PDFName.of('Outlines'))
  outlines.set(PDFName.of('First'), first)
  outlines.set(PDFName.of('Last'), last)
  outlines.set(PDFName.of('Count'), PDFNumber.of(countVisible(items)))
  ctx.assign(outlinesRef, outlines)

  catalog.set(PDFName.of('Outlines'), outlinesRef)
}
