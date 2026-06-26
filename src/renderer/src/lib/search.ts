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

export interface SearchOptions {
  /** Match letter case exactly (default: case-insensitive). */
  caseSensitive?: boolean
  /** Require the match to be bounded by non-word characters (default: off). */
  wholeWord?: boolean
}

/** Resolves a source page's text items (same array `PageView` renders from). */
export type TextItemsResolver = (ref: SourcePageRef) => Promise<readonly TextContentItem[]>

const itemText = (item: TextContentItem): string => ('str' in item ? item.str : '')

// Unicode-aware word character (so accented letters in non-English languages
// count as part of a word for whole-word matching).
const WORD_CHAR = /[\p{L}\p{N}_]/u
const isWordChar = (char: string | undefined): boolean => char !== undefined && WORD_CHAR.test(char)

/**
 * Searches every (source) page of a document's logical page model for
 * `rawQuery`, in reading order, reporting progress. Matching is case-insensitive
 * and substring by default; `options` enables case-sensitive and whole-word
 * matching. Blank pages are skipped. Match page numbers are logical, matching
 * what the viewer renders.
 */
export async function searchDocument(
  pages: PageRef[],
  resolve: TextItemsResolver,
  rawQuery: string,
  onProgress?: (scannedPages: number, totalPages: number, found: number) => void,
  signal?: SearchSignal,
  options?: SearchOptions
): Promise<SearchMatch[]> {
  const caseSensitive = options?.caseSensitive ?? false
  const wholeWord = options?.wholeWord ?? false
  const trimmed = rawQuery.trim()
  const query = caseSensitive ? trimmed : trimmed.toLowerCase()
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

      const haystack = caseSensitive ? text : text.toLowerCase()
      let from = 0
      for (;;) {
        const index = haystack.indexOf(query, from)
        if (index === -1) break
        const end = index + query.length
        // Whole-word: reject if a word character hugs either edge of the match.
        if (wholeWord && (isWordChar(haystack[index - 1]) || isWordChar(haystack[end]))) {
          from = index + 1
          continue
        }
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
