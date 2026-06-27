import { describe, it, expect } from 'vitest'
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib'
import { addLinkAnnotations } from '@/lib/pdfLinks'
import type { PageLink } from '@/lib/links'

const RECT = { x: 50, y: 200, width: 120, height: 20 }

async function buildWith(links: PageLink[]): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 400])
  addLinkAnnotations(page, links)
  const bytes = await doc.save()
  return PDFDocument.load(bytes)
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
})
