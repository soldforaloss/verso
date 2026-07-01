import { create } from 'zustand'

/** A save deferred until the user resolves its unapplied redaction marks. */
export interface PendingRedactionSave {
  tabId: string
  saveAs: boolean
}

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
  /** Whether the "discard unsaved changes and quit?" dialog is open. */
  quitConfirmOpen: boolean
  setQuitConfirmOpen: (open: boolean) => void
  /** A save awaiting a decision about unapplied redaction marks (null = none). */
  redactionSavePrompt: PendingRedactionSave | null
  setRedactionSavePrompt: (prompt: PendingRedactionSave | null) => void
  /** A non-save write (extract/split/…) blocked by unapplied redaction marks. */
  redactionBlock: { tabId: string } | null
  setRedactionBlock: (block: { tabId: string } | null) => void
}

export const useUiStore = create<UiState>((set, get) => ({
  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  openShortcuts: () => set({ shortcutsOpen: true }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  toggleCommandPalette: () => set({ commandPaletteOpen: !get().commandPaletteOpen }),
  quitConfirmOpen: false,
  setQuitConfirmOpen: (quitConfirmOpen) => set({ quitConfirmOpen }),
  redactionSavePrompt: null,
  setRedactionSavePrompt: (redactionSavePrompt) => set({ redactionSavePrompt }),
  redactionBlock: null,
  setRedactionBlock: (redactionBlock) => set({ redactionBlock })
}))
