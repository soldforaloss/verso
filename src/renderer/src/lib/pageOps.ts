import {
  attachSourceToTab,
  registerSource,
  useDocumentStore,
  type PdfSource
} from '@/store/documentStore'
import { useHistoryStore } from '@/store/historyStore'
import { pageKey, type CropBox, type PageRef } from '@/lib/pageModel'
import * as transforms from '@/lib/pageTransforms'

const DEFAULT_BLANK = { width: 612, height: 792 } // US Letter

function currentPages(tabId: string): PageRef[] | undefined {
  return useDocumentStore.getState().getTab(tabId)?.pages
}

/** Routes a page-list change through the undo/redo engine as one command. */
function commit(tabId: string, label: string, next: PageRef[]): void {
  const before = currentPages(tabId)
  if (!before || next === before) return
  useHistoryStore.getState().execute(tabId, {
    label,
    redo: () => useDocumentStore.getState().setPages(tabId, next),
    undo: () => useDocumentStore.getState().setPages(tabId, before)
  })
}

export function rotatePages(tabId: string, indices: number[], delta: number): void {
  const pages = currentPages(tabId)
  if (!pages) return
  commit(
    tabId,
    indices.length > 1 ? 'Rotate pages' : 'Rotate page',
    transforms.rotate(pages, indices, delta)
  )
}

/**
 * Sets (or clears, with null) the crop box on the source pages named in the map,
 * keyed by 0-based page index. One undoable command. Per-index crops let a single
 * "crop all pages" action apply correctly across pages of differing size.
 */
export function cropPages(
  tabId: string,
  cropByIndex: Record<number, CropBox | null>,
  label = 'Crop pages'
): void {
  const pages = currentPages(tabId)
  if (!pages) return
  let changed = false
  const next = pages.map((page, index) => {
    if (!(index in cropByIndex) || page.kind !== 'source') return page
    const crop = cropByIndex[index] ?? null
    if ((page.crop ?? null) === null && crop === null) return page
    changed = true
    return { ...page, crop }
  })
  if (!changed) return
  commit(tabId, label, next)
}

export function deletePages(tabId: string, indices: number[]): void {
  const pages = currentPages(tabId)
  if (!pages) return
  commit(
    tabId,
    indices.length > 1 ? 'Delete pages' : 'Delete page',
    transforms.remove(pages, indices)
  )
}

export function duplicatePages(tabId: string, indices: number[]): void {
  const pages = currentPages(tabId)
  if (!pages) return
  commit(
    tabId,
    indices.length > 1 ? 'Duplicate pages' : 'Duplicate page',
    transforms.duplicate(pages, indices)
  )
}

export function movePages(tabId: string, indices: number[], toIndex: number): void {
  const pages = currentPages(tabId)
  if (!pages) return
  commit(tabId, 'Reorder pages', transforms.move(pages, indices, toIndex))
}

export function movePagesBy(tabId: string, indices: number[], direction: -1 | 1): void {
  if (indices.length === 0) return
  const sorted = indices.slice().sort((a, b) => a - b)
  const target = direction < 0 ? sorted[0]! - 1 : sorted[sorted.length - 1]! + 2
  movePages(tabId, indices, target)
}

export function insertBlankPage(tabId: string, atIndex: number): void {
  const pages = currentPages(tabId)
  if (!pages) return
  const neighbor = pages[Math.max(0, atIndex - 1)]
  const size =
    neighbor && neighbor.kind === 'blank'
      ? { width: neighbor.width, height: neighbor.height }
      : DEFAULT_BLANK
  const blank = transforms.makeBlankPage(size.width, size.height)
  commit(tabId, 'Insert blank page', transforms.insertPages(pages, atIndex, [blank]))
}

/** Loads `bytes` as a new source and inserts its pages at `atIndex`. */
export async function insertPagesFromBytes(
  tabId: string,
  atIndex: number,
  bytes: Uint8Array
): Promise<number> {
  if (!currentPages(tabId)) return 0
  const { id: sourceId, pageCount } = await registerSource(bytes)
  attachSourceToTab(tabId, sourceId)
  const inserted: PageRef[] = Array.from({ length: pageCount }, (_, index) => ({
    key: pageKey(),
    kind: 'source',
    sourceId,
    sourceIndex: index,
    rotation: 0
  }))
  const latest = currentPages(tabId)
  if (!latest) return 0
  commit(
    tabId,
    pageCount > 1 ? 'Insert pages' : 'Insert page',
    transforms.insertPages(latest, atIndex, inserted)
  )
  return pageCount
}

export type { PdfSource }
