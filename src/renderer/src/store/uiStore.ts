import { create } from 'zustand'

/** Small store for app-global UI surfaces that several components toggle. */
interface UiState {
  /** Whether the keyboard-shortcuts cheat-sheet is open. */
  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void
  openShortcuts: () => void
  /** Whether the command palette is open. */
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  toggleCommandPalette: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  openShortcuts: () => set({ shortcutsOpen: true }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  toggleCommandPalette: () => set({ commandPaletteOpen: !get().commandPaletteOpen })
}))
