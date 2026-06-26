import { describe, it, expect } from 'vitest'
import { searchDocument, type TextItemsResolver } from '@/lib/search'
import type { TextContentItem } from '@/lib/pdf'
import type { PageRef } from '@/lib/pageModel'

/** Builds a fake source-page model plus a resolver from per-page item strings. */
function build(perPage: string[][]): { pages: PageRef[]; resolve: TextItemsResolver } {
  const pages: PageRef[] = perPage.map((_, index) => ({
    key: `k${index}`,
    kind: 'source',
    sourceId: 's',
    sourceIndex: index,
    rotation: 0
  }))
  const resolve: TextItemsResolver = async (ref) =>
    perPage[ref.sourceIndex]!.map((str) => ({ str })) as unknown as readonly TextContentItem[]
  return { pages, resolve }
}

describe('searchDocument', () => {
  it('finds a query inside a single text item', async () => {
    const { pages, resolve } = build([['Hello ', 'world']])
    expect(await searchDocument(pages, resolve, 'world')).toEqual([{ page: 1, itemIndices: [1] }])
  })

  it('is case-insensitive', async () => {
    const { pages, resolve } = build([['Hello WORLD']])
    expect(await searchDocument(pages, resolve, 'world')).toHaveLength(1)
  })

  it('reports a match that crosses text-item boundaries', async () => {
    const { pages, resolve } = build([['foo', 'bar']])
    const matches = await searchDocument(pages, resolve, 'ob')
    expect(matches[0]?.itemIndices).toEqual([0, 1])
  })

  it('counts matches across multiple logical pages in order', async () => {
    const { pages, resolve } = build([['alpha'], ['beta alpha'], ['gamma']])
    const matches = await searchDocument(pages, resolve, 'alpha')
    expect(matches.map((m) => m.page)).toEqual([1, 2])
  })

  it('skips blank pages and uses logical page numbers', async () => {
    const pages: PageRef[] = [
      { key: 'a', kind: 'source', sourceId: 's', sourceIndex: 0, rotation: 0 },
      { key: 'b', kind: 'blank', width: 100, height: 100, rotation: 0 },
      { key: 'c', kind: 'source', sourceId: 's', sourceIndex: 1, rotation: 0 }
    ]
    const text = [['has target'], ['also target']]
    const resolve: TextItemsResolver = async (ref) =>
      text[ref.sourceIndex]!.map((str) => ({ str })) as unknown as readonly TextContentItem[]
    const matches = await searchDocument(pages, resolve, 'target')
    expect(matches.map((m) => m.page)).toEqual([1, 3])
  })

  it('returns nothing for a blank query', async () => {
    const { pages, resolve } = build([['anything']])
    expect(await searchDocument(pages, resolve, '   ')).toHaveLength(0)
  })

  it('honours cancellation', async () => {
    const { pages, resolve } = build([['x'], ['x']])
    expect(await searchDocument(pages, resolve, 'x', undefined, { cancelled: true })).toHaveLength(
      0
    )
  })

  it('matches case exactly when caseSensitive is set', async () => {
    const { pages, resolve } = build([['Hello WORLD world']])
    const insensitive = await searchDocument(pages, resolve, 'world')
    expect(insensitive).toHaveLength(2)
    const sensitive = await searchDocument(pages, resolve, 'world', undefined, undefined, {
      caseSensitive: true
    })
    expect(sensitive).toHaveLength(1)
  })

  it('matches only whole words when wholeWord is set', async () => {
    const { pages, resolve } = build([['cat scatter cat-nap concatenate']])
    const substring = await searchDocument(pages, resolve, 'cat')
    expect(substring).toHaveLength(4) // cat, sCATter, cat-nap, conCATenate
    const wholeWord = await searchDocument(pages, resolve, 'cat', undefined, undefined, {
      wholeWord: true
    })
    expect(wholeWord).toHaveLength(2) // "cat" and "cat"(-nap); the others are inside words
  })

  it('treats accented letters as word characters for whole-word matching', async () => {
    const { pages, resolve } = build([['café cafés']])
    const matches = await searchDocument(pages, resolve, 'café', undefined, undefined, {
      wholeWord: true
    })
    expect(matches).toHaveLength(1) // "café" matches; "cafés" is a longer word
  })
})
