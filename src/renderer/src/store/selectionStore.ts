import { create } from 'zustand'

/**
 * Page selection in the thumbnail rail, as 0-based page indices. Drives bulk
 * page operations (rotate/delete/duplicate/extract) from the toolbar and
 * context menu.
 */
interface SelectionState {
  selected: number[]
  anchor: number | null
  set: (indices: number[]) => void
  /** Click: select just this page (and set the range anchor). */
  selectOnly: (index: number) => void
  /** Ctrl/Cmd-click: toggle this page in/out of the selection. */
  toggle: (index: number) => void
  /** Shift-click: select the range from the anchor to this page. */
  selectRange: (index: number) => void
  clear: () => void
}

const sortUnique = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b)

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selected: [],
  anchor: null,

  set: (indices) => set({ selected: sortUnique(indices) }),
  selectOnly: (index) => set({ selected: [index], anchor: index }),
  toggle: (index) => {
    const current = new Set(get().selected)
    if (current.has(index)) current.delete(index)
    else current.add(index)
    set({ selected: sortUnique([...current]), anchor: index })
  },
  selectRange: (index) => {
    const anchor = get().anchor ?? index
    const [lo, hi] = anchor <= index ? [anchor, index] : [index, anchor]
    const range = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
    set({ selected: range })
  },
  clear: () => set({ selected: [], anchor: null })
}))
