import { describe, it, expect } from 'vitest'
import { searchDocument } from '@/lib/search'
import type { PdfDocument } from '@/lib/pdf'

/** Builds a minimal fake PdfDocument from page → text-item strings. */
function fakePdf(pages: string[][]): PdfDocument {
  return {
    numPages: pages.length,
    getPage: async (pageNumber: number) => ({
      getTextContent: async () => ({ items: pages[pageNumber - 1]!.map((str) => ({ str })) })
    })
  } as unknown as PdfDocument
}

describe('searchDocument', () => {
  it('finds a query inside a single text item', async () => {
    const matches = await searchDocument(fakePdf([['Hello ', 'world']]), 'world')
    expect(matches).toEqual([{ page: 1, itemIndices: [1] }])
  })

  it('is case-insensitive', async () => {
    const matches = await searchDocument(fakePdf([['Hello WORLD']]), 'world')
    expect(matches).toHaveLength(1)
  })

  it('reports a match that crosses text-item boundaries', async () => {
    // "foobar" → "ob" spans items 0 and 1.
    const matches = await searchDocument(fakePdf([['foo', 'bar']]), 'ob')
    expect(matches[0]?.itemIndices).toEqual([0, 1])
  })

  it('counts matches across multiple pages in reading order', async () => {
    const matches = await searchDocument(fakePdf([['alpha'], ['beta alpha'], ['gamma']]), 'alpha')
    expect(matches).toHaveLength(2)
    expect(matches.map((m) => m.page)).toEqual([1, 2])
  })

  it('finds repeated matches on one page', async () => {
    const matches = await searchDocument(fakePdf([['ababab']]), 'ab')
    expect(matches).toHaveLength(3)
  })

  it('returns nothing for a blank query', async () => {
    expect(await searchDocument(fakePdf([['anything']]), '   ')).toHaveLength(0)
  })

  it('honours cancellation', async () => {
    const matches = await searchDocument(fakePdf([['x'], ['x']]), 'x', undefined, {
      cancelled: true
    })
    expect(matches).toHaveLength(0)
  })
})
