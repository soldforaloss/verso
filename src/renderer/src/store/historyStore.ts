import { create } from 'zustand'

/**
 * A reversible command. `redo` applies (or re-applies) the change; `undo`
 * reverts it. Page operations express these as snapshots of the page list.
 */
export interface Command {
  label: string
  redo: () => void
  undo: () => void
}

interface DocHistory {
  past: Command[]
  future: Command[]
}

/** Cap on retained undo steps per document. */
const MAX_DEPTH = 200

interface HistoryState {
  histories: Record<string, DocHistory>
  /** Runs `command.redo()` and records it on the document's undo stack. */
  execute: (documentId: string, command: Command) => void
  undo: (documentId: string) => void
  redo: (documentId: string) => void
  /** Drops a document's history (e.g. when its tab closes). */
  forget: (documentId: string) => void
}

function historyFor(state: HistoryState, id: string): DocHistory {
  return state.histories[id] ?? { past: [], future: [] }
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  histories: {},

  execute: (documentId, command) => {
    command.redo()
    set((state) => {
      const current = historyFor(state, documentId)
      const past = [...current.past, command].slice(-MAX_DEPTH)
      return { histories: { ...state.histories, [documentId]: { past, future: [] } } }
    })
  },

  undo: (documentId) => {
    const current = historyFor(get(), documentId)
    const command = current.past[current.past.length - 1]
    if (!command) return
    command.undo()
    set((state) => {
      const history = historyFor(state, documentId)
      return {
        histories: {
          ...state.histories,
          [documentId]: {
            past: history.past.slice(0, -1),
            future: [command, ...history.future]
          }
        }
      }
    })
  },

  redo: (documentId) => {
    const current = historyFor(get(), documentId)
    const command = current.future[0]
    if (!command) return
    command.redo()
    set((state) => {
      const history = historyFor(state, documentId)
      return {
        histories: {
          ...state.histories,
          [documentId]: {
            past: [...history.past, command],
            future: history.future.slice(1)
          }
        }
      }
    })
  },

  forget: (documentId) =>
    set((state) => {
      const next = { ...state.histories }
      delete next[documentId]
      return { histories: next }
    })
}))

/** Reactive selector helpers for toolbar enablement. */
export const selectCanUndo =
  (documentId: string | null) =>
  (state: HistoryState): boolean =>
    documentId ? (state.histories[documentId]?.past.length ?? 0) > 0 : false

export const selectCanRedo =
  (documentId: string | null) =>
  (state: HistoryState): boolean =>
    documentId ? (state.histories[documentId]?.future.length ?? 0) > 0 : false
