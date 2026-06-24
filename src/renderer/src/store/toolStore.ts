import { create } from 'zustand'
import { ANNOTATION_COLORS, type TextFontFamily } from '@/lib/annotations'

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
  /** Default text face/spacing for new text boxes (and tool-bar editing). */
  fontFamily: TextFontFamily
  bold: boolean
  italic: boolean
  letterSpacing: number
  /** Currently selected annotation (in select mode), if any. */
  selectedId: string | null
  selectedPageKey: string | null
  setTool: (tool: Tool) => void
  setColor: (color: string) => void
  setStrokeWidth: (strokeWidth: number) => void
  setFontSize: (fontSize: number) => void
  setFontFamily: (fontFamily: TextFontFamily) => void
  setBold: (bold: boolean) => void
  setItalic: (italic: boolean) => void
  setLetterSpacing: (letterSpacing: number) => void
  selectAnnotation: (pageKey: string, id: string) => void
  clearSelection: () => void
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'select',
  color: ANNOTATION_COLORS[0],
  strokeWidth: 2,
  fontSize: 14,
  fontFamily: 'sans-serif',
  bold: false,
  italic: false,
  letterSpacing: 0,
  selectedId: null,
  selectedPageKey: null,
  // Switching tools clears any annotation selection.
  setTool: (tool) => set({ tool, selectedId: null, selectedPageKey: null }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setBold: (bold) => set({ bold }),
  setItalic: (italic) => set({ italic }),
  setLetterSpacing: (letterSpacing) => set({ letterSpacing }),
  selectAnnotation: (selectedPageKey, selectedId) => set({ selectedPageKey, selectedId }),
  clearSelection: () => set({ selectedId: null, selectedPageKey: null })
}))
