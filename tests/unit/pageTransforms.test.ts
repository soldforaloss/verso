import { describe, it, expect } from 'vitest'
import { duplicate, insertPages, makeBlankPage, move, remove, rotate } from '@/lib/pageTransforms'
import type { PageRef } from '@/lib/pageModel'

function pages(count: number): PageRef[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `k${index}`,
    kind: 'source',
    sourceId: 's',
    sourceIndex: index,
    rotation: 0
  }))
}

const keys = (list: PageRef[]): string[] => list.map((p) => p.key)

describe('pageTransforms', () => {
  describe('rotate', () => {
    it('adds rotation to the selected pages only', () => {
      const next = rotate(pages(3), [1], 90)
      expect(next.map((p) => p.rotation)).toEqual([0, 90, 0])
    })
    it('wraps past 360', () => {
      const next = rotate(rotate(pages(1), [0], 270), [0], 180)
      expect(next[0]?.rotation).toBe(90)
    })
  })

  describe('remove', () => {
    it('removes the selected pages', () => {
      expect(keys(remove(pages(3), [1]))).toEqual(['k0', 'k2'])
    })
    it('never empties the document', () => {
      const input = pages(2)
      expect(remove(input, [0, 1])).toBe(input)
    })
  })

  describe('duplicate', () => {
    it('inserts a copy after each selected page with a fresh key', () => {
      const next = duplicate(pages(2), [0])
      expect(next).toHaveLength(3)
      expect(next[0]?.key).toBe('k0')
      expect(next[1]?.key).not.toBe('k0')
      expect((next[1] as { sourceIndex: number }).sourceIndex).toBe(0)
    })
  })

  describe('move', () => {
    it('moves a page to the front', () => {
      expect(keys(move(pages(3), [2], 0))).toEqual(['k2', 'k0', 'k1'])
    })
    it('moves a page to the end', () => {
      expect(keys(move(pages(3), [0], 3))).toEqual(['k1', 'k2', 'k0'])
    })
    it('moves a contiguous block', () => {
      expect(keys(move(pages(4), [0, 1], 4))).toEqual(['k2', 'k3', 'k0', 'k1'])
    })
    it('returns the same reference when nothing moves', () => {
      const input = pages(3)
      expect(move(input, [0], 0)).toBe(input)
    })
  })

  describe('insertPages', () => {
    it('inserts at the given index', () => {
      const blank = makeBlankPage(612, 792)
      const next = insertPages(pages(2), 1, [blank])
      expect(keys(next)).toEqual(['k0', blank.key, 'k1'])
    })
    it('clamps an out-of-range index to the end', () => {
      const blank = makeBlankPage(612, 792)
      expect(insertPages(pages(2), 99, [blank]).at(-1)?.key).toBe(blank.key)
    })
  })
})
