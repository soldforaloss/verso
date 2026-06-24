import type { PdfDocument, TextContentItem } from './pdf'

/** A single full-text match, located by the page text items it spans. */
export interface SearchMatch {
  /** 1-based page number. */
  page: number
  /**
   * Indices (into that page's `getTextContent().items`) of the text items the
   * match overlaps. Indices line up with what `PageView` fetches, so it can
   * draw highlight rectangles without re-deriving positions.
   */
  itemIndices: number[]
}

/** Cancellation token threaded through a long search. */
export interface SearchSignal {
  cancelled: boolean
}

const itemText = (item: TextContentItem): string => ('str' in item ? item.str : '')

/**
 * Searches every page of a document for `rawQuery` (case-insensitive) and
 * returns matches in reading order. Pages are scanned lazily one at a time and
 * progress is reported, so the UI can show a running count without blocking.
 */
export async function searchDocument(
  pdf: PdfDocument,
  rawQuery: string,
  onProgress?: (scannedPages: number, totalPages: number, found: number) => void,
  signal?: SearchSignal
): Promise<SearchMatch[]> {
  const query = rawQuery.trim().toLowerCase()
  const matches: SearchMatch[] = []
  if (!query) return matches

  const total = pdf.numPages
  for (let page = 1; page <= total; page += 1) {
    if (signal?.cancelled) break

    const content = await (await pdf.getPage(page)).getTextContent()
    const items = content.items

    // Concatenate the page text and record where each item starts.
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
      matches.push({ page, itemIndices: spanned })
      from = end
    }

    onProgress?.(page, total, matches.length)
  }

  return matches
}
