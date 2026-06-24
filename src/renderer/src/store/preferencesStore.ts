import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

interface PreferencesState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

/**
 * Resolves a (possibly `system`) theme preference to the concrete light/dark
 * value that should be applied right now.
 *
 * NOTE: persistence currently uses `localStorage`. In M1 this migrates to the
 * main process (preferences written to disk via IPC) per the spec's
 * "persist UI preferences to disk via the main process" requirement.
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

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: resolveTheme(get().theme) === 'dark' ? 'light' : 'dark' })
    }),
    { name: 'verso.preferences' }
  )
)
