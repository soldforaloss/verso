import { create } from 'zustand'
import { searchDocument, type SearchMatch, type SearchSignal } from '@/lib/search'
import type { PdfDocument } from '@/lib/pdf'
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

  open: () => void
  close: () => void
  setQuery: (query: string) => void
  run: (pdf: PdfDocument) => Promise<void>
  next: () => void
  prev: () => void
  reset: () => void
}

// Only one search may be in flight; a new run cancels the previous.
let activeSignal: SearchSignal | null = null

function scrollToMatch(matches: SearchMatch[], index: number): void {
  const match = matches[index]
  if (match) useViewStore.getState().requestScrollToPage(match.page)
}

export const useSearchStore = create<SearchState>((set, get) => ({
  isOpen: false,
  query: '',
  matches: [],
  activeIndex: 0,
  status: 'idle',
  scannedPages: 0,
  totalPages: 0,

  open: () => set({ isOpen: true }),
  close: () => {
    if (activeSignal) activeSignal.cancelled = true
    // Keep the query (for quick re-open) but clear results so highlights vanish.
    set({ isOpen: false, matches: [], activeIndex: 0, status: 'idle' })
  },
  setQuery: (query) => set({ query }),

  run: async (pdf) => {
    if (activeSignal) activeSignal.cancelled = true
    const signal: SearchSignal = { cancelled: false }
    activeSignal = signal

    const query = get().query
    if (!query.trim()) {
      set({
        matches: [],
        activeIndex: 0,
        status: 'idle',
        scannedPages: 0,
        totalPages: pdf.numPages
      })
      return
    }

    set({
      status: 'searching',
      matches: [],
      activeIndex: 0,
      scannedPages: 0,
      totalPages: pdf.numPages
    })
    const matches = await searchDocument(
      pdf,
      query,
      (scannedPages, totalPages) => {
        if (!signal.cancelled) set({ scannedPages, totalPages })
      },
      signal
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

  reset: () => {
    if (activeSignal) activeSignal.cancelled = true
    set({ query: '', matches: [], activeIndex: 0, status: 'idle', scannedPages: 0, totalPages: 0 })
  }
}))
