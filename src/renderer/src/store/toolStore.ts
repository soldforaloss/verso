import { create } from 'zustand'
import { ANNOTATION_COLORS } from '@/lib/annotations'

export type Tool =
  | 'select'
  | 'ink'
  | 'eraser'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text'
  | 'note'
  | 'highlight'
  | 'underline'
  | 'strike'
  | 'squiggly'
  | 'edittext'
  | 'redaction'

export const MARKUP_TOOLS = new Set<Tool>(['highlight', 'underline', 'strike', 'squiggly'])
export const DRAWING_TOOLS = new Set<Tool>(['ink', 'rect', 'ellipse', 'line', 'arrow', 'redaction'])
export const PLACING_TOOLS = new Set<Tool>(['text', 'note'])

interface ToolState {
  tool: Tool
  color: string
  strokeWidth: number
  fontSize: number
  /** Currently selected annotation (in select mode), if any. */
  selectedId: string | null
  selectedPageKey: string | null
  setTool: (tool: Tool) => void
  setColor: (color: string) => void
  setStrokeWidth: (strokeWidth: number) => void
  setFontSize: (fontSize: number) => void
  selectAnnotation: (pageKey: string, id: string) => void
  clearSelection: () => void
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'select',
  color: ANNOTATION_COLORS[0],
  strokeWidth: 2,
  fontSize: 14,
  selectedId: null,
  selectedPageKey: null,
  // Switching tools clears any annotation selection.
  setTool: (tool) => set({ tool, selectedId: null, selectedPageKey: null }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  selectAnnotation: (selectedPageKey, selectedId) => set({ selectedPageKey, selectedId }),
  clearSelection: () => set({ selectedId: null, selectedPageKey: null })
}))
