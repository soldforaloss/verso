import { create } from 'zustand'
import { ANNOTATION_COLORS, type TextFontFamily } from '@/lib/annotations'
import type { MeasureUnit } from '@/lib/measure'

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
  | 'editimage'
  | 'measure'
  | 'redaction'
  | 'link'
  | 'field-text'
  | 'field-checkbox'
  | 'field-dropdown'
  | 'field-optionlist'
  | 'field-radio'

export const MARKUP_TOOLS = new Set<Tool>(['highlight', 'underline', 'strike', 'squiggly'])
export const DRAWING_TOOLS = new Set<Tool>(['ink', 'rect', 'ellipse', 'line', 'arrow', 'redaction'])
export const PLACING_TOOLS = new Set<Tool>(['text', 'note'])
/** Tools that draw a rectangle to author a fillable AcroForm field. */
export const FIELD_TOOLS = new Set<Tool>([
  'field-text',
  'field-checkbox',
  'field-dropdown',
  'field-optionlist',
  'field-radio'
])

/**
 * Single-key shortcuts for the most-used tools (the single source of truth for
 * the keydown handler, toolbar tooltips, and the cheat-sheet). The destructive
 * tools — redaction and eraser — are intentionally left without a single key.
 */
export const TOOL_SHORTCUTS: { key: string; tool: Tool; label: string }[] = [
  { key: 'v', tool: 'select', label: 'Select / edit' },
  { key: 'h', tool: 'highlight', label: 'Highlight' },
  { key: 'u', tool: 'underline', label: 'Underline' },
  { key: 's', tool: 'strike', label: 'Strikethrough' },
  { key: 'p', tool: 'ink', label: 'Draw (pencil)' },
  { key: 'r', tool: 'rect', label: 'Rectangle' },
  { key: 'o', tool: 'ellipse', label: 'Ellipse' },
  { key: 'l', tool: 'line', label: 'Line' },
  { key: 'a', tool: 'arrow', label: 'Arrow' },
  { key: 't', tool: 'text', label: 'Text box' },
  { key: 'n', tool: 'note', label: 'Sticky note' },
  { key: 'e', tool: 'edittext', label: 'Edit text' }
]

export const toolForKey = (key: string): Tool | undefined =>
  TOOL_SHORTCUTS.find((shortcut) => shortcut.key === key)?.tool

export const keyForTool = (tool: Tool): string | undefined =>
  TOOL_SHORTCUTS.find((shortcut) => shortcut.tool === tool)?.key

interface ToolState {
  tool: Tool
  color: string
  strokeWidth: number
  opacity: number
  fontSize: number
  /** Default text face/spacing for new text boxes (and tool-bar editing). */
  fontFamily: TextFontFamily
  bold: boolean
  italic: boolean
  letterSpacing: number
  /** Unit shown by the measure tool. */
  measureUnit: MeasureUnit
  /** Currently selected annotation (in select mode), if any. */
  selectedId: string | null
  selectedPageKey: string | null
  setTool: (tool: Tool) => void
  setMeasureUnit: (unit: MeasureUnit) => void
  setColor: (color: string) => void
  setStrokeWidth: (strokeWidth: number) => void
  setOpacity: (opacity: number) => void
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
  opacity: 1,
  fontSize: 14,
  fontFamily: 'sans-serif',
  bold: false,
  italic: false,
  letterSpacing: 0,
  measureUnit: 'in',
  selectedId: null,
  selectedPageKey: null,
  // Switching tools clears any annotation selection.
  setTool: (tool) => set({ tool, selectedId: null, selectedPageKey: null }),
  setMeasureUnit: (measureUnit) => set({ measureUnit }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setOpacity: (opacity) => set({ opacity }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setBold: (bold) => set({ bold }),
  setItalic: (italic) => set({ italic }),
  setLetterSpacing: (letterSpacing) => set({ letterSpacing }),
  selectAnnotation: (selectedPageKey, selectedId) => set({ selectedPageKey, selectedId }),
  clearSelection: () => set({ selectedId: null, selectedPageKey: null })
}))
