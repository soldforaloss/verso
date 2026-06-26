import { describe, it, expect } from 'vitest'
import {
  appendItem,
  countVisible,
  deleteItem,
  indentItem,
  makeOutlineItem,
  moveItem,
  outdentItem,
  renameItem,
  type OutlineItem
} from '@/lib/outline'

const leaf = (id: string, children: OutlineItem[] = []): OutlineItem => ({
  id,
  title: id,
  pageKey: `key-${id}`,
  children,
  expanded: true
})

const ids = (items: OutlineItem[]): string[] => items.map((i) => i.id)

describe('outline transforms', () => {
  it('renames an item at any depth', () => {
    const tree = [leaf('a', [leaf('b')])]
    const out = renameItem(tree, 'b', 'Renamed')
    expect(out[0]!.children[0]!.title).toBe('Renamed')
    expect(out[0]!.title).toBe('a')
  })

  it('deletes an item and its subtree anywhere', () => {
    const tree = [leaf('a', [leaf('b', [leaf('c')])]), leaf('d')]
    expect(ids(deleteItem(tree, 'a'))).toEqual(['d'])
    const inner = deleteItem(tree, 'b')
    expect(inner[0]!.children).toEqual([])
  })

  it('appends a top-level item', () => {
    const tree = [leaf('a')]
    expect(ids(appendItem(tree, makeOutlineItem('New', 'k')))).toEqual(['a', expect.any(String)])
  })

  it('moves within a sibling list and is a no-op at the edges', () => {
    const tree = [leaf('a'), leaf('b'), leaf('c')]
    expect(ids(moveItem(tree, 'b', -1))).toEqual(['b', 'a', 'c'])
    expect(ids(moveItem(tree, 'b', 1))).toEqual(['a', 'c', 'b'])
    expect(moveItem(tree, 'a', -1)).toBe(tree) // first up: unchanged reference
    expect(moveItem(tree, 'c', 1)).toBe(tree) // last down: unchanged reference
  })

  it('moves within a nested sibling list', () => {
    const tree = [leaf('p', [leaf('x'), leaf('y')])]
    const out = moveItem(tree, 'y', -1)
    expect(ids(out[0]!.children)).toEqual(['y', 'x'])
  })

  it('indents an item under its previous sibling (and opens it)', () => {
    const tree = [leaf('a'), leaf('b')]
    const out = indentItem(tree, 'b')
    expect(ids(out)).toEqual(['a'])
    expect(ids(out[0]!.children)).toEqual(['b'])
    expect(out[0]!.expanded).toBe(true)
  })

  it('does not indent a first sibling', () => {
    const tree = [leaf('a'), leaf('b')]
    expect(indentItem(tree, 'a')).toBe(tree)
  })

  it('outdents a child to sit after its parent', () => {
    const tree = [leaf('p', [leaf('c1'), leaf('c2')])]
    const out = outdentItem(tree, 'c1')
    expect(ids(out)).toEqual(['p', 'c1'])
    expect(ids(out[0]!.children)).toEqual(['c2'])
  })

  it('does not outdent a top-level item', () => {
    const tree = [leaf('a')]
    expect(outdentItem(tree, 'a')).toEqual(tree)
  })

  it('counts visible items honoring collapsed parents', () => {
    const open = [leaf('a', [leaf('b'), leaf('c')]), leaf('d')]
    expect(countVisible(open)).toBe(4) // a, b, c, d
    const collapsed: OutlineItem[] = [
      { ...leaf('a', [leaf('b'), leaf('c')]), expanded: false },
      leaf('d')
    ]
    expect(countVisible(collapsed)).toBe(2) // a (collapsed), d
  })
})
