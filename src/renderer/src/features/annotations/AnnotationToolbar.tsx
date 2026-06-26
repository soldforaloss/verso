import {
  ArrowUpRight,
  Bold,
  BringToFront,
  Circle,
  Eraser,
  EyeOff,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Minus,
  MousePointer2,
  Pencil,
  SendToBack,
  Square,
  Strikethrough,
  StickyNote,
  TextCursorInput,
  Trash2,
  Type,
  Underline,
  Waves
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { keyForTool, useToolStore, type Tool } from '@/store/toolStore'
import { useViewStore } from '@/store/viewStore'
import {
  addImageAnnotation,
  removeAnnotation,
  reorderAnnotation,
  updateAnnotation
} from '@/lib/annotationOps'
import { ANNOTATION_COLORS, type Annotation, type TextFontFamily } from '@/lib/annotations'
import type { DocumentTab } from '@/store/documentStore'

// Tools grouped by purpose (select · markup · draw · text · destructive) so the
// toolbar reads as clusters rather than one long row. Markup and edit are also
// reachable from the floating selection popover.
const TOOL_GROUPS: { tool: Tool; label: string; Icon: typeof Square }[][] = [
  [{ tool: 'select', label: 'Select / edit', Icon: MousePointer2 }],
  [
    { tool: 'highlight', label: 'Highlight text', Icon: Highlighter },
    { tool: 'underline', label: 'Underline text', Icon: Underline },
    { tool: 'strike', label: 'Strikethrough text', Icon: Strikethrough },
    { tool: 'squiggly', label: 'Squiggly text', Icon: Waves }
  ],
  [
    { tool: 'ink', label: 'Freehand draw', Icon: Pencil },
    { tool: 'rect', label: 'Rectangle', Icon: Square },
    { tool: 'ellipse', label: 'Ellipse', Icon: Circle },
    { tool: 'line', label: 'Line', Icon: Minus },
    { tool: 'arrow', label: 'Arrow', Icon: ArrowUpRight }
  ],
  [
    { tool: 'text', label: 'Text box', Icon: Type },
    { tool: 'note', label: 'Sticky note', Icon: StickyNote },
    { tool: 'edittext', label: 'Edit existing text (cover & replace)', Icon: TextCursorInput }
  ],
  [
    { tool: 'redaction', label: 'Redaction (black out & destroy content)', Icon: EyeOff },
    { tool: 'eraser', label: 'Eraser (click to delete)', Icon: Eraser }
  ]
]

const WIDTHS = [1, 2, 4, 8]

const FAMILIES: { value: TextFontFamily; label: string }[] = [
  { value: 'sans-serif', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Mono' }
]

export function AnnotationToolbar({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const tool = useToolStore((s) => s.tool)
  const setTool = useToolStore((s) => s.setTool)
  const color = useToolStore((s) => s.color)
  const setColor = useToolStore((s) => s.setColor)
  const strokeWidth = useToolStore((s) => s.strokeWidth)
  const setStrokeWidth = useToolStore((s) => s.setStrokeWidth)
  const opacity = useToolStore((s) => s.opacity)
  const setOpacity = useToolStore((s) => s.setOpacity)
  const fontFamily = useToolStore((s) => s.fontFamily)
  const setFontFamily = useToolStore((s) => s.setFontFamily)
  const bold = useToolStore((s) => s.bold)
  const setBold = useToolStore((s) => s.setBold)
  const italic = useToolStore((s) => s.italic)
  const setItalic = useToolStore((s) => s.setItalic)
  const fontSize = useToolStore((s) => s.fontSize)
  const setFontSize = useToolStore((s) => s.setFontSize)
  const letterSpacing = useToolStore((s) => s.letterSpacing)
  const setLetterSpacing = useToolStore((s) => s.setLetterSpacing)
  const selectedId = useToolStore((s) => s.selectedId)
  const selectedPageKey = useToolStore((s) => s.selectedPageKey)
  const clearSelection = useToolStore((s) => s.clearSelection)
  const selectAnnotation = useToolStore((s) => s.selectAnnotation)
  const currentPage = useViewStore((s) => s.currentPage)

  const selected: Annotation | undefined =
    selectedId && selectedPageKey
      ? tab.annotations[selectedPageKey]?.find((a) => a.id === selectedId)
      : undefined
  const selectedText = selected?.type === 'text' ? selected : undefined
  const showText = tool === 'text' || tool === 'edittext' || Boolean(selectedText)

  // Current text-style values reflect the selected text box, else tool defaults.
  const curFamily = selectedText?.fontFamily ?? fontFamily
  const curBold = selectedText?.bold ?? bold
  const curItalic = selectedText?.italic ?? italic
  const curSize = selectedText?.fontSize ?? fontSize
  const curSpacing = selectedText?.letterSpacing ?? letterSpacing

  // Reflect the selected annotation's style if one is selected, else the tool
  // defaults used for the next annotation.
  const activeColor = selected?.color ?? color
  const activeOpacity = selected?.opacity ?? opacity

  const applyColor = (next: string): void => {
    setColor(next)
    if (selected) updateAnnotation(tab.id, { ...selected, color: next }, 'Recolor annotation')
  }
  const applyWidth = (next: number): void => {
    setStrokeWidth(next)
    if (selected && 'strokeWidth' in selected) {
      updateAnnotation(tab.id, { ...selected, strokeWidth: next }, 'Restyle annotation')
    }
  }
  const applyOpacity = (next: number): void => {
    setOpacity(next)
    if (selected) updateAnnotation(tab.id, { ...selected, opacity: next }, 'Adjust opacity')
  }
  const applyTextChange = (patch: Partial<Extract<Annotation, { type: 'text' }>>): void => {
    if (selectedText) updateAnnotation(tab.id, { ...selectedText, ...patch }, 'Restyle text')
  }
  const applyFontFamily = (next: typeof fontFamily): void => {
    setFontFamily(next)
    // Choosing a generic family overrides any matched bundled font.
    if (selectedText) {
      const updated: Extract<Annotation, { type: 'text' }> = { ...selectedText, fontFamily: next }
      delete updated.fontKey
      updateAnnotation(tab.id, updated, 'Restyle text')
    }
  }
  const applyBold = (): void => {
    const next = !curBold
    setBold(next)
    applyTextChange({ bold: next })
  }
  const applyItalic = (): void => {
    const next = !curItalic
    setItalic(next)
    applyTextChange({ italic: next })
  }
  const applyFontSize = (next: number): void => {
    if (!Number.isFinite(next)) return
    const clamped = Math.max(4, Math.min(200, next))
    setFontSize(clamped)
    applyTextChange({ fontSize: clamped })
  }
  const applyLetterSpacing = (next: number): void => {
    if (!Number.isFinite(next)) return
    const clamped = Math.max(-20, Math.min(40, next))
    setLetterSpacing(clamped)
    applyTextChange({ letterSpacing: clamped })
  }
  const deleteSelected = (): void => {
    if (selectedId && selectedPageKey) {
      removeAnnotation(tab.id, selectedPageKey, selectedId)
      clearSelection()
    }
  }

  const insertImage = (): void => {
    const pageKey = tab.pages[Math.min(currentPage, tab.pages.length) - 1]?.key
    if (!pageKey) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg'
    input.onchange = (): void => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (): void => {
        const dataUrl = String(reader.result)
        const image = new Image()
        image.onload = (): void => {
          const id = addImageAnnotation(tab.id, pageKey, dataUrl, image.width / image.height)
          selectAnnotation(pageKey, id)
        }
        image.src = dataUrl
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-card px-2 py-1">
      <div className="flex items-center gap-0.5">
        {TOOL_GROUPS.map((group, groupIndex) => (
          <div key={group[0]!.tool} className="flex items-center gap-0.5">
            {groupIndex > 0 && <span className="mx-0.5 h-5 w-px bg-border" />}
            {group.map(({ tool: t, label, Icon }) => {
              const shortcut = keyForTool(t)
              return (
                <button
                  key={t}
                  type="button"
                  title={shortcut ? `${label} (${shortcut.toUpperCase()})` : label}
                  aria-pressed={tool === t}
                  onClick={() => setTool(t)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-md transition-colors',
                    tool === t ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  )}
                >
                  <Icon className="size-4" />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      <div className="flex items-center gap-1">
        {ANNOTATION_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            title={swatch}
            aria-label={`Color ${swatch}`}
            onClick={() => applyColor(swatch)}
            className={cn(
              'size-5 rounded-full border',
              activeColor.toLowerCase() === swatch
                ? 'ring-2 ring-ring ring-offset-1 ring-offset-background'
                : 'border-black/20'
            )}
            style={{ background: swatch }}
          />
        ))}
        {/* Custom color: any hex the presets don't cover. */}
        <label
          title="Custom color"
          className="relative size-5 cursor-pointer overflow-hidden rounded-full border border-black/20"
          style={{ background: activeColor }}
        >
          <input
            type="color"
            aria-label="Custom color"
            value={/^#[0-9a-fA-F]{6}$/.test(activeColor) ? activeColor : '#000000'}
            onChange={(event) => applyColor(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      <div className="flex items-center gap-0.5" title="Stroke width">
        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={strokeWidth === w}
            onClick={() => applyWidth(w)}
            className={cn(
              'flex size-7 items-center justify-center rounded-md hover:bg-accent',
              strokeWidth === w && 'bg-secondary'
            )}
          >
            <span className="rounded-full bg-foreground" style={{ width: w + 2, height: w + 2 }} />
          </button>
        ))}
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Opacity">
        <span aria-hidden>◑</span>
        <input
          type="range"
          aria-label="Opacity"
          min={0.1}
          max={1}
          step={0.05}
          value={activeOpacity}
          onChange={(event) => applyOpacity(Number.parseFloat(event.target.value))}
          className="h-1 w-20 cursor-pointer accent-primary"
        />
        <span className="w-8 tabular-nums">{Math.round(activeOpacity * 100)}%</span>
      </label>

      {showText && (
        <>
          <div className="mx-1 h-5 w-px bg-border" />
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-md border p-0.5">
              {FAMILIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  title={`${label} font`}
                  aria-pressed={curFamily === value}
                  onClick={() => applyFontFamily(value)}
                  className={cn(
                    'rounded-[5px] px-1.5 py-0.5 text-xs transition-colors',
                    value === 'serif' && 'font-serif',
                    value === 'monospace' && 'font-mono',
                    curFamily === value
                      ? 'bg-secondary text-secondary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              title="Bold"
              aria-pressed={curBold}
              onClick={applyBold}
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors',
                curBold ? 'bg-secondary' : 'hover:bg-accent'
              )}
            >
              <Bold className="size-4" />
            </button>
            <button
              type="button"
              title="Italic"
              aria-pressed={curItalic}
              onClick={applyItalic}
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors',
                curItalic ? 'bg-secondary' : 'hover:bg-accent'
              )}
            >
              <Italic className="size-4" />
            </button>
            <label
              className="flex items-center gap-1 text-xs text-muted-foreground"
              title="Font size"
            >
              <Type className="size-3.5" />
              <input
                type="number"
                key={`${selectedText?.id ?? 'default'}:size`}
                defaultValue={Math.round(curSize)}
                min={4}
                max={200}
                onBlur={(event) => applyFontSize(Number.parseFloat(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
                className="w-12 rounded border bg-background px-1 py-0.5 text-xs text-foreground"
              />
            </label>
            <label
              className="flex items-center gap-1 text-xs text-muted-foreground"
              title="Letter spacing (tracking)"
            >
              <span className="font-medium tracking-[0.15em]">A↔</span>
              <input
                type="number"
                step={0.5}
                key={`${selectedText?.id ?? 'default'}:spacing`}
                defaultValue={Number(curSpacing.toFixed(1))}
                onBlur={(event) => applyLetterSpacing(Number.parseFloat(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
                className="w-12 rounded border bg-background px-1 py-0.5 text-xs text-foreground"
              />
            </label>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          title="Bring to front (Ctrl+])"
          disabled={!selected}
          onClick={() =>
            selected && reorderAnnotation(tab.id, selected.pageKey, selected.id, 'front')
          }
        >
          <BringToFront />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Send to back (Ctrl+[)"
          disabled={!selected}
          onClick={() =>
            selected && reorderAnnotation(tab.id, selected.pageKey, selected.id, 'back')
          }
        >
          <SendToBack />
        </Button>
        <Button variant="ghost" size="icon" title="Insert image" onClick={insertImage}>
          <ImageIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Delete selected annotation (Del)"
          disabled={!selected}
          onClick={deleteSelected}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}
