import { create } from 'zustand'
import { loadPdfDocument, type PdfDocument } from '@/lib/pdf'
import { pageKey, type PageRef } from '@/lib/pageModel'
import type { Annotation } from '@/lib/annotations'
import type { DocumentMetadata } from '@/lib/metadata'
import { useHistoryStore } from './historyStore'
import type { OpenedDocument } from '@shared/ipc'

export type DocumentStatus = 'loading' | 'ready' | 'error'

export interface DocumentTab {
  id: string
  name: string
  /** Absolute path of the original file, or null (e.g. after merge/extract). */
  path: string | null
  status: DocumentStatus
  error: string | null
  /** True when the page model differs from the last saved state. */
  dirty: boolean
  /** The current logical page list (the editable model). */
  pages: PageRef[]
  /** Source documents this tab references (primary + inserted/merged). */
  sourceIds: string[]
  /** Annotations keyed by the logical page's stable key. */
  annotations: Record<string, Annotation[]>
  /** Bumped when a source's bytes are replaced (e.g. OCR), to force re-render. */
  sourceRevision: number
  /** User-edited Info-dictionary metadata, applied on save (null = unchanged). */
  metadata: DocumentMetadata | null
}

export interface PdfSource {
  pdf: PdfDocument
  bytes: Uint8Array
  destroy: () => Promise<void>
}

/**
 * Source PDFs (PDF.js proxies + original bytes) live outside the reactive store
 * because proxies/byte arrays must not be frozen. The store holds only metadata
 * and the logical page model.
 */
const sourceCache = new Map<string, PdfSource>()

export function getSource(sourceId: string): PdfSource | undefined {
  return sourceCache.get(sourceId)
}

/** Loads bytes as a new source and returns its id + page count. */
export async function registerSource(
  bytes: Uint8Array
): Promise<{ id: string; pageCount: number }> {
  const id = crypto.randomUUID()
  const { pdf, destroy } = await loadPdfDocument(bytes)
  sourceCache.set(id, { pdf, bytes, destroy })
  return { id, pageCount: pdf.numPages }
}

interface DocumentState {
  tabs: DocumentTab[]
  activeId: string | null
  openDocument: (source: OpenedDocument) => Promise<void>
  closeDocument: (id: string) => void
  setActive: (id: string) => void
  /** Replaces a tab's page list and marks it dirty (used by page commands). */
  setPages: (id: string, pages: PageRef[]) => void
  /** Replaces one page's annotations and marks the tab dirty. */
  setPageAnnotations: (id: string, pageKey: string, annotations: Annotation[]) => void
  /** Records a successful save: clears dirty and updates path/name. */
  markSaved: (id: string, path: string, name: string) => void
  /** Marks a tab dirty (e.g. when a form field changes). */
  markDirty: (id: string) => void
  /** Stores edited document metadata (applied on save) and marks the tab dirty. */
  setMetadata: (id: string, metadata: DocumentMetadata) => void
  /** Replaces a source's bytes (e.g. after OCR) and forces a re-render. */
  replaceSource: (tabId: string, sourceId: string, bytes: Uint8Array) => Promise<void>
  /**
   * Replaces the whole document with a single new flattened source (e.g. after
   * applying redactions). Annotations are dropped, history is cleared, and the
   * page list is rebuilt 1:1. The tab is marked dirty so the user can save it.
   */
  replaceDocument: (tabId: string, bytes: Uint8Array) => Promise<void>
  getTab: (id: string) => DocumentTab | undefined
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  tabs: [],
  activeId: null,

  getTab: (id) => get().tabs.find((tab) => tab.id === id),

  openDocument: async (source) => {
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
      status: 'loading',
      error: null,
      dirty: false,
      pages: [],
      sourceIds: [source.id],
      annotations: {},
      sourceRevision: 0,
      metadata: null
    }
    set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }))

    try {
      const { pdf, destroy } = await loadPdfDocument(source.bytes)
      sourceCache.set(source.id, { pdf, bytes: source.bytes, destroy })
      const pages: PageRef[] = Array.from({ length: pdf.numPages }, (_, index) => ({
        key: pageKey(),
        kind: 'source',
        sourceId: source.id,
        sourceIndex: index,
        rotation: 0
      }))
      set((state) => ({
        tabs: state.tabs.map((existing) =>
          existing.id === source.id ? { ...existing, status: 'ready', pages } : existing
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
    const tab = get().tabs.find((t) => t.id === id)
    if (tab) {
      for (const sourceId of tab.sourceIds) {
        const source = sourceCache.get(sourceId)
        if (source) {
          void source.destroy()
          sourceCache.delete(sourceId)
        }
      }
    }
    useHistoryStore.getState().forget(id)
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id)
      let activeId = state.activeId
      if (activeId === id) activeId = tabs.length > 0 ? tabs[tabs.length - 1]!.id : null
      return { tabs, activeId }
    })
  },

  setActive: (id) => set({ activeId: id }),

  setPages: (id, pages) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, pages, dirty: true } : tab))
    })),

  setPageAnnotations: (id, pageKey, annotations) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id
          ? { ...tab, dirty: true, annotations: { ...tab.annotations, [pageKey]: annotations } }
          : tab
      )
    })),

  markSaved: (id, path, name) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, path, name, dirty: false } : tab))
    })),

  markDirty: (id) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id && !tab.dirty ? { ...tab, dirty: true } : tab))
    })),

  setMetadata: (id, metadata) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, metadata, dirty: true } : tab))
    })),

  replaceSource: async (tabId, sourceId, bytes) => {
    const previous = sourceCache.get(sourceId)
    const { pdf, destroy } = await loadPdfDocument(bytes)
    sourceCache.set(sourceId, { pdf, bytes, destroy })
    if (previous) void previous.destroy()
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, dirty: true, sourceRevision: tab.sourceRevision + 1 } : tab
      )
    }))
  },

  replaceDocument: async (tabId, bytes) => {
    const { id, pageCount } = await registerSource(bytes)
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId)
      if (tab) {
        // Release every prior source the tab owned (the new one replaces them).
        for (const previousId of tab.sourceIds) {
          if (previousId === id) continue
          const source = sourceCache.get(previousId)
          if (source) {
            void source.destroy()
            sourceCache.delete(previousId)
          }
        }
      }
      const pages: PageRef[] = Array.from({ length: pageCount }, (_, index) => ({
        key: pageKey(),
        kind: 'source',
        sourceId: id,
        sourceIndex: index,
        rotation: 0
      }))
      return {
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                pages,
                sourceIds: [id],
                annotations: {},
                dirty: true,
                sourceRevision: t.sourceRevision + 1
              }
            : t
        )
      }
    })
    // Redaction is irreversible by design — the prior history would reference
    // page keys and content that no longer exist.
    useHistoryStore.getState().forget(tabId)
  }
}))

/** Registers a source id under a tab so it is destroyed when the tab closes. */
export function attachSourceToTab(tabId: string, sourceId: string): void {
  useDocumentStore.setState((state) => ({
    tabs: state.tabs.map((tab) =>
      tab.id === tabId && !tab.sourceIds.includes(sourceId)
        ? { ...tab, sourceIds: [...tab.sourceIds, sourceId] }
        : tab
    )
  }))
}
