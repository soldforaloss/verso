import { addRotation, pageKey, type BlankPageRef, type PageRef } from './pageModel'

/**
 * Pure transforms on the logical page list. They never touch stores or PDF.js,
 * so they are trivially unit-testable; `pageOps` wraps them with history/state.
 * Each returns a new array (or the same reference when nothing changes).
 */

export function rotate(pages: PageRef[], indices: number[], delta: number): PageRef[] {
  if (indices.length === 0) return pages
  const set = new Set(indices)
  return pages.map((page, index) =>
    set.has(index) ? { ...page, rotation: addRotation(page.rotation, delta) } : page
  )
}

export function remove(pages: PageRef[], indices: number[]): PageRef[] {
  if (indices.length === 0) return pages
  const set = new Set(indices)
  const next = pages.filter((_, index) => !set.has(index))
  return next.length === 0 ? pages : next // never empty the document
}

export function duplicate(pages: PageRef[], indices: number[]): PageRef[] {
  if (indices.length === 0) return pages
  const set = new Set(indices)
  const next: PageRef[] = []
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]!
    next.push(page)
    if (set.has(index)) next.push({ ...page, key: pageKey() })
  }
  return next
}

/** Moves the selected pages so the block lands at `toIndex` in the original list. */
export function move(pages: PageRef[], indices: number[], toIndex: number): PageRef[] {
  if (indices.length === 0) return pages
  const set = new Set(indices)
  const moved = indices
    .slice()
    .sort((a, b) => a - b)
    .map((index) => pages[index]!)
  const remaining = pages.filter((_, index) => !set.has(index))
  const before = indices.filter((index) => index < toIndex).length
  const insertAt = Math.max(0, Math.min(remaining.length, toIndex - before))
  const next = [...remaining.slice(0, insertAt), ...moved, ...remaining.slice(insertAt)]
  return next.every((page, index) => page === pages[index]) ? pages : next
}

export function insertPages(pages: PageRef[], atIndex: number, inserted: PageRef[]): PageRef[] {
  const clamped = Math.max(0, Math.min(pages.length, atIndex))
  return [...pages.slice(0, clamped), ...inserted, ...pages.slice(clamped)]
}

export function makeBlankPage(width: number, height: number): BlankPageRef {
  return { key: pageKey(), kind: 'blank', rotation: 0, width, height }
}
