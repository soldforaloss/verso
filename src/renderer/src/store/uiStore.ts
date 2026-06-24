import { create } from 'zustand'

/** Small store for app-global UI surfaces that several components toggle. */
interface UiState {
  /** Whether the keyboard-shortcuts cheat-sheet is open. */
  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void
  openShortcuts: () => void
}

export const useUiStore = create<UiState>((set) => ({
  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  openShortcuts: () => set({ shortcutsOpen: true })
}))
