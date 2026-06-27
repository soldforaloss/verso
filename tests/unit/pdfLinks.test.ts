import { describe, it, expect } from 'vitest'
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib'
import { addLinkAnnotations } from '@/lib/pdfLinks'
import type { PageLink } from '@/lib/links'

const RECT = { x: 50, y: 200, width: 120, height: 20 }

async function buildWith(links: PageLink[], extraPages = 0): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 400])
  for (let i = 0; i < extraPages; i += 1) doc.addPage([400, 400])
  const pages = doc.getPages()
  addLinkAnnotations(page, links, (n) => pages[n - 1])
  const bytes = await doc.save()
  return PDFDocument.load(bytes)
}

/** The /GoTo target page indices (0-based) of every /Link on page 1. */
function goToTargets(doc: PDFDocument): number[] {
  const annots = doc.getPage(0).node.Annots()
  if (!annots) return []
  const pageRefs = doc.getPages().map((p) => p.ref)
  const targets: number[] = []
  for (let i = 0; i < annots.size(); i += 1) {
    const dict = annots.lookup(i, PDFDict)
    if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Link')) continue
    const action = dict.lookup(PDFName.of('A'), PDFDict)
    if (action.get(PDFName.of('S')) !== PDFName.of('GoTo')) continue
    const ref = action.lookup(PDFName.of('D'), PDFArray).get(0)
    targets.push(pageRefs.findIndex((p) => p === ref))
  }
  return targets
}

/** The URIs of every /Link annotation on page 1 of the document. */
function linkUris(doc: PDFDocument): string[] {
  const annots = doc.getPage(0).node.Annots()
  if (!annots) return []
  const uris: string[] = []
  for (let i = 0; i < annots.size(); i += 1) {
    const dict = annots.lookup(i, PDFDict)
    if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Link')) continue
    const action = dict.lookup(PDFName.of('A'), PDFDict)
    const uri = action.lookup(PDFName.of('URI'))
    if (uri instanceof PDFString || uri instanceof PDFHexString) uris.push(uri.decodeText())
  }
  return uris
}

describe('addLinkAnnotations', () => {
  it('writes a clickable /Link annotation with a URI action', async () => {
    const reloaded = await buildWith([
      { id: '1', url: 'https://example.com', rect: RECT },
      { id: '2', url: 'example.org/docs', rect: { x: 10, y: 10, width: 80, height: 16 } }
    ])
    const uris = linkUris(reloaded)
    expect(uris).toContain('https://example.com/')
    expect(uris).toContain('https://example.org/docs')
  })

  it('skips links whose URL is dangerous or invalid (no annotation written)', async () => {
    const reloaded = await buildWith([
      { id: '1', url: 'javascript:alert(1)', rect: RECT },
      { id: '2', url: '', rect: RECT },
      { id: '3', url: 'file:///etc/passwd', rect: RECT }
    ])
    expect(linkUris(reloaded)).toEqual([])
  })

  it('writes only the valid links from a mixed set', async () => {
    const reloaded = await buildWith([
      { id: '1', url: 'javascript:evil()', rect: RECT },
      { id: '2', url: 'https://ok.example', rect: RECT }
    ])
    expect(linkUris(reloaded)).toEqual(['https://ok.example/'])
  })

  it('round-trips URLs with PDF delimiter characters (parens, backslash)', async () => {
    // A literal PDF string would break on these; the URI is written as hex.
    const reloaded = await buildWith([
      { id: '1', url: 'https://en.wikipedia.org/wiki/Sentence_(linguistics)', rect: RECT },
      { id: '2', url: 'https://example.com/foo)bar', rect: { x: 0, y: 0, width: 9, height: 9 } }
    ])
    const uris = linkUris(reloaded)
    expect(uris).toContain('https://en.wikipedia.org/wiki/Sentence_(linguistics)')
    expect(uris).toContain('https://example.com/foo)bar')
  })

  it('writes an internal /GoTo link to the target page', async () => {
    // 3-page doc; a link on page 1 jumping to page 3 (1-based) -> index 2.
    const reloaded = await buildWith([{ id: '1', url: '', page: 3, rect: RECT }], 2)
    expect(goToTargets(reloaded)).toEqual([2])
    expect(linkUris(reloaded)).toEqual([]) // it's a GoTo, not a URI
  })

  it('skips an internal link whose target page is out of range', async () => {
    const reloaded = await buildWith([{ id: '1', url: '', page: 9, rect: RECT }], 2)
    expect(goToTargets(reloaded)).toEqual([])
  })

  it('resolves internal targets through the resolver and drops unresolved ones (extract/split)', async () => {
    // Simulate extracting pages {1,5} of a larger doc: only page 1 and page 5
    // survive. A link on page 1 targeting page 5 must point at the surviving
    // page; a link targeting page 2 (excluded) must be dropped, not mis-aimed.
    const doc = await PDFDocument.create()
    const src = doc.addPage([400, 400]) // emitted page 1 (doc page 1)
    const surviving = doc.addPage([400, 400]) // emitted page 2 (doc page 5)
    // Document-global page number → placed output page; pages 2,3,4 excluded.
    const resolve = (n: number): typeof surviving | undefined =>
      n === 1 ? src : n === 5 ? surviving : undefined
    addLinkAnnotations(
      src,
      [
        { id: 'a', url: '', page: 5, rect: RECT }, // → surviving (index 1)
        { id: 'b', url: '', page: 2, rect: RECT } // excluded → dropped
      ],
      resolve
    )
    const reloaded = await PDFDocument.load(await doc.save())
    expect(goToTargets(reloaded)).toEqual([1])
  })
})
