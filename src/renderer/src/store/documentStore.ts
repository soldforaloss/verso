import { create } from 'zustand'
import { loadPdfDocument, type PdfDocument } from '@/lib/pdf'
import type { OpenedDocument } from '@shared/ipc'

export type DocumentStatus = 'loading' | 'ready' | 'error'

export interface DocumentTab {
  id: string
  name: string
  path: string | null
  /** Original bytes, retained for saving/editing in later milestones. */
  bytes: Uint8Array
  pageCount: number
  status: DocumentStatus
  error: string | null
  dirty: boolean
}

/**
 * PDF.js proxies are non-serializable and must not be frozen (Immer/Object.freeze
 * would break their internal state), so they live here, outside the reactive
 * store. The store holds only plain metadata.
 */
const pdfCache = new Map<string, PdfDocument>()
const destroyers = new Map<string, () => Promise<void>>()

export function getDocumentPdf(id: string): PdfDocument | undefined {
  return pdfCache.get(id)
}

interface DocumentState {
  tabs: DocumentTab[]
  activeId: string | null
  openDocument: (source: OpenedDocument) => Promise<void>
  closeDocument: (id: string) => void
  setActive: (id: string) => void
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  tabs: [],
  activeId: null,

  openDocument: async (source) => {
    // If this file is already open, just focus its tab.
    if (source.path) {
      const existing = get().tabs.find((tab) => tab.path === source.path)
      if (existing) {
        set({ activeId: existing.id })
        return
      }
    }

    const tab: DocumentTab = {
      id: source.id,
      name: source.name,
      path: source.path,
      bytes: source.bytes,
      pageCount: 0,
      status: 'loading',
      error: null,
      dirty: false
    }
    set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }))

    try {
      const { pdf, destroy } = await loadPdfDocument(source.bytes)
      pdfCache.set(source.id, pdf)
      destroyers.set(source.id, destroy)
      set((state) => ({
        tabs: state.tabs.map((existing) =>
          existing.id === source.id
            ? { ...existing, status: 'ready', pageCount: pdf.numPages }
            : existing
        )
      }))
    } catch (error) {
      set((state) => ({
        tabs: state.tabs.map((existing) =>
          existing.id === source.id
            ? {
                ...existing,
                status: 'error',
                error: error instanceof Error ? error.message : 'Failed to load PDF'
              }
            : existing
        )
      }))
    }
  },

  closeDocument: (id) => {
    const destroy = destroyers.get(id)
    if (destroy) void destroy()
    destroyers.delete(id)
    pdfCache.delete(id)
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.id !== id)
      let activeId = state.activeId
      if (activeId === id) {
        activeId = tabs.length > 0 ? tabs[tabs.length - 1]!.id : null
      }
      return { tabs, activeId }
    })
  },

  setActive: (id) => set({ activeId: id })
}))
