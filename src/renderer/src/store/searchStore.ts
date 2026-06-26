import { create } from 'zustand'
import { searchDocument, type SearchMatch, type SearchSignal } from '@/lib/search'
import type { TextContentItem } from '@/lib/pdf'
import type { SourcePageRef } from '@/lib/pageModel'
import { getSource, type DocumentTab } from './documentStore'
import { useViewStore } from './viewStore'

type SearchStatus = 'idle' | 'searching' | 'done'

interface SearchState {
  isOpen: boolean
  query: string
  matches: SearchMatch[]
  activeIndex: number
  status: SearchStatus
  scannedPages: number
  totalPages: number
  caseSensitive: boolean
  wholeWord: boolean

  open: () => void
  close: () => void
  setQuery: (query: string) => void
  run: (tab: DocumentTab) => Promise<void>
  next: () => void
  prev: () => void
  toggleCaseSensitive: () => void
  toggleWholeWord: () => void
  reset: () => void
}

let activeSignal: SearchSignal | null = null

function scrollToMatch(matches: SearchMatch[], index: number): void {
  const match = matches[index]
  if (match) useViewStore.getState().requestScrollToPage(match.page)
}

async function getTextItems(ref: SourcePageRef): Promise<readonly TextContentItem[]> {
  const source = getSource(ref.sourceId)
  if (!source) return []
  const page = await source.pdf.getPage(ref.sourceIndex + 1)
  return (await page.getTextContent()).items
}

export const useSearchStore = create<SearchState>((set, get) => ({
  isOpen: false,
  query: '',
  matches: [],
  activeIndex: 0,
  status: 'idle',
  scannedPages: 0,
  totalPages: 0,
  caseSensitive: false,
  wholeWord: false,

  open: () => set({ isOpen: true }),
  close: () => {
    if (activeSignal) activeSignal.cancelled = true
    set({ isOpen: false, matches: [], activeIndex: 0, status: 'idle' })
  },
  setQuery: (query) => set({ query }),

  run: async (tab) => {
    if (activeSignal) activeSignal.cancelled = true
    const signal: SearchSignal = { cancelled: false }
    activeSignal = signal

    const query = get().query
    const totalPages = tab.pages.length
    if (!query.trim()) {
      set({ matches: [], activeIndex: 0, status: 'idle', scannedPages: 0, totalPages })
      return
    }

    set({ status: 'searching', matches: [], activeIndex: 0, scannedPages: 0, totalPages })
    const matches = await searchDocument(
      tab.pages,
      getTextItems,
      query,
      (scannedPages, total) => {
        if (!signal.cancelled) set({ scannedPages, totalPages: total })
      },
      signal,
      { caseSensitive: get().caseSensitive, wholeWord: get().wholeWord }
    )
    if (signal.cancelled) return

    set({ matches, status: 'done', activeIndex: 0 })
    scrollToMatch(matches, 0)
  },

  next: () => {
    const { matches, activeIndex } = get()
    if (matches.length === 0) return
    const index = (activeIndex + 1) % matches.length
    set({ activeIndex: index })
    scrollToMatch(matches, index)
  },
  prev: () => {
    const { matches, activeIndex } = get()
    if (matches.length === 0) return
    const index = (activeIndex - 1 + matches.length) % matches.length
    set({ activeIndex: index })
    scrollToMatch(matches, index)
  },

  toggleCaseSensitive: () => set((state) => ({ caseSensitive: !state.caseSensitive })),
  toggleWholeWord: () => set((state) => ({ wholeWord: !state.wholeWord })),

  reset: () => {
    if (activeSignal) activeSignal.cancelled = true
    set({ query: '', matches: [], activeIndex: 0, status: 'idle', scannedPages: 0, totalPages: 0 })
  }
}))
