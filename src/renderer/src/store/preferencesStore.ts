import { create } from 'zustand'
import type { LayoutMode, Preferences, ReadingMode, ThemeMode } from '@shared/ipc'

/**
 * UI preferences, persisted to disk by the main process (per the spec's
 * "persist UI preferences via the main process"). The store is hydrated from
 * disk on startup and writes through every change.
 */

export function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  }
  return theme
}

/** Applies the resolved theme by toggling the `.dark` class on <html>. */
export function applyTheme(theme: ThemeMode): void {
  const resolved = resolveTheme(theme)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
}

/** Fire-and-forget write-through to the main process (no-op outside Electron). */
function persist(patch: Partial<Preferences>): void {
  if (typeof window !== 'undefined' && window.api) {
    void window.api.setPreferences(patch)
  }
}

interface PreferencesState extends Preferences {
  hydrated: boolean
  hydrate: (prefs: Preferences) => void
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setLayout: (layout: LayoutMode) => void
  setReadingMode: (mode: ReadingMode) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setOcrLanguage: (code: string) => void
  setExperimentalPdfiumRenderer: (enabled: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  theme: 'system',
  layout: 'continuous',
  readingMode: 'normal',
  sidebarOpen: true,
  ocrLanguage: 'eng',
  experimentalPdfiumRenderer: false,
  hydrated: false,

  hydrate: (prefs) => set({ ...prefs, hydrated: true }),

  setTheme: (theme) => {
    set({ theme })
    persist({ theme })
  },
  toggleTheme: () => {
    const next: ThemeMode = resolveTheme(get().theme) === 'dark' ? 'light' : 'dark'
    set({ theme: next })
    persist({ theme: next })
  },
  setLayout: (layout) => {
    set({ layout })
    persist({ layout })
  },
  setReadingMode: (readingMode) => {
    set({ readingMode })
    persist({ readingMode })
  },
  setSidebarOpen: (sidebarOpen) => {
    set({ sidebarOpen })
    persist({ sidebarOpen })
  },
  toggleSidebar: () => {
    const sidebarOpen = !get().sidebarOpen
    set({ sidebarOpen })
    persist({ sidebarOpen })
  },
  setOcrLanguage: (ocrLanguage) => {
    set({ ocrLanguage })
    persist({ ocrLanguage })
  },
  setExperimentalPdfiumRenderer: (experimentalPdfiumRenderer) => {
    set({ experimentalPdfiumRenderer })
    persist({ experimentalPdfiumRenderer })
  }
}))
