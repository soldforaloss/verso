import { create } from 'zustand'
import { clampScale, normalizeRotation, ZOOM_STEP } from '@/lib/geometry'

export type ZoomMode = 'fit-width' | 'fit-page' | 'custom'

/**
 * Transient, per-view state for the active document: zoom, rotation, and the
 * page the user is currently looking at. Persisted preferences (layout, theme,
 * reading mode) live in the preferences store instead.
 */
interface ViewState {
  zoomMode: ZoomMode
  scale: number
  rotation: 0 | 90 | 180 | 270
  currentPage: number
  /** Set when the user asks to jump to a page; the viewer scrolls then clears it. */
  pendingScrollPage: number | null

  setZoomMode: (mode: ZoomMode) => void
  /** Updates the scale from a fit calculation, keeping the current fit mode. */
  applyFitScale: (scale: number) => void
  /** Sets an explicit scale and switches to custom zoom. */
  setScale: (scale: number) => void
  zoomIn: () => void
  zoomOut: () => void
  rotateCw: () => void
  rotateCcw: () => void
  setCurrentPage: (page: number) => void
  /** Requests a jump to a page (updates currentPage and asks the viewer to scroll). */
  requestScrollToPage: (page: number) => void
  clearPendingScroll: () => void
  resetForDocument: () => void
}

export const useViewStore = create<ViewState>((set) => ({
  zoomMode: 'fit-width',
  scale: 1,
  rotation: 0,
  currentPage: 1,
  pendingScrollPage: null,

  setZoomMode: (mode) => set({ zoomMode: mode }),
  applyFitScale: (scale) => set({ scale: clampScale(scale) }),
  setScale: (scale) => set({ zoomMode: 'custom', scale: clampScale(scale) }),
  zoomIn: () =>
    set((state) => ({ zoomMode: 'custom', scale: clampScale(state.scale * ZOOM_STEP) })),
  zoomOut: () =>
    set((state) => ({ zoomMode: 'custom', scale: clampScale(state.scale / ZOOM_STEP) })),
  rotateCw: () => set((state) => ({ rotation: normalizeRotation(state.rotation + 90) })),
  rotateCcw: () => set((state) => ({ rotation: normalizeRotation(state.rotation - 90) })),
  setCurrentPage: (page) => set({ currentPage: Math.max(1, page) }),
  requestScrollToPage: (page) =>
    set({ currentPage: Math.max(1, page), pendingScrollPage: Math.max(1, page) }),
  clearPendingScroll: () => set({ pendingScrollPage: null }),
  resetForDocument: () => set({ currentPage: 1, rotation: 0, zoomMode: 'fit-width' })
}))
