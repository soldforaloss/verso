import type { TextContentItem } from './pdf'
import type { PageRef, SourcePageRef } from './pageModel'

/** A single full-text match, located by the page text items it spans. */
export interface SearchMatch {
  /** 1-based **logical** page number (index into the document's page model). */
  page: number
  /** Indices into that source page's text items that the match overlaps. */
  itemIndices: number[]
}

export interface SearchSignal {
  cancelled: boolean
}

/** Resolves a source page's text items (same array `PageView` renders from). */
export type TextItemsResolver = (ref: SourcePageRef) => Promise<readonly TextContentItem[]>

const itemText = (item: TextContentItem): string => ('str' in item ? item.str : '')

/**
 * Searches every (source) page of a document's logical page model for
 * `rawQuery` (case-insensitive), in reading order, reporting progress. Blank
 * pages are skipped. Match page numbers are logical, matching what the viewer
 * renders.
 */
export async function searchDocument(
  pages: PageRef[],
  resolve: TextItemsResolver,
  rawQuery: string,
  onProgress?: (scannedPages: number, totalPages: number, found: number) => void,
  signal?: SearchSignal
): Promise<SearchMatch[]> {
  const query = rawQuery.trim().toLowerCase()
  const matches: SearchMatch[] = []
  if (!query) return matches

  const total = pages.length
  for (let pageIndex = 0; pageIndex < total; pageIndex += 1) {
    if (signal?.cancelled) break
    const ref = pages[pageIndex]

    if (ref && ref.kind === 'source') {
      const items = await resolve(ref)

      let text = ''
      const itemStart: number[] = new Array(items.length)
      for (let k = 0; k < items.length; k += 1) {
        itemStart[k] = text.length
        text += itemText(items[k]!)
      }

      const haystack = text.toLowerCase()
      let from = 0
      for (;;) {
        const index = haystack.indexOf(query, from)
        if (index === -1) break
        const end = index + query.length
        const spanned: number[] = []
        for (let k = 0; k < items.length; k += 1) {
          const start = itemStart[k]!
          const stop = start + itemText(items[k]!).length
          if (stop > index && start < end) spanned.push(k)
        }
        matches.push({ page: pageIndex + 1, itemIndices: spanned })
        from = end
      }
    }

    onProgress?.(pageIndex + 1, total, matches.length)
  }

  return matches
}
