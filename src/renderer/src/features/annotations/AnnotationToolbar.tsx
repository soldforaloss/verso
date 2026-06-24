import {
  ArrowUpRight,
  Circle,
  Eraser,
  Highlighter,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  Strikethrough,
  StickyNote,
  Trash2,
  Type,
  Underline,
  Waves
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToolStore, type Tool } from '@/store/toolStore'
import { removeAnnotation, updateAnnotation } from '@/lib/annotationOps'
import { ANNOTATION_COLORS, type Annotation } from '@/lib/annotations'
import type { DocumentTab } from '@/store/documentStore'

const TOOLS: { tool: Tool; label: string; Icon: typeof Square }[] = [
  { tool: 'select', label: 'Select / edit', Icon: MousePointer2 },
  { tool: 'highlight', label: 'Highlight text', Icon: Highlighter },
  { tool: 'underline', label: 'Underline text', Icon: Underline },
  { tool: 'strike', label: 'Strikethrough text', Icon: Strikethrough },
  { tool: 'squiggly', label: 'Squiggly text', Icon: Waves },
  { tool: 'ink', label: 'Freehand draw', Icon: Pencil },
  { tool: 'rect', label: 'Rectangle', Icon: Square },
  { tool: 'ellipse', label: 'Ellipse', Icon: Circle },
  { tool: 'line', label: 'Line', Icon: Minus },
  { tool: 'arrow', label: 'Arrow', Icon: ArrowUpRight },
  { tool: 'text', label: 'Text box', Icon: Type },
  { tool: 'note', label: 'Sticky note', Icon: StickyNote },
  { tool: 'eraser', label: 'Eraser (click to delete)', Icon: Eraser }
]

const WIDTHS = [1, 2, 4, 8]

export function AnnotationToolbar({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const tool = useToolStore((s) => s.tool)
  const setTool = useToolStore((s) => s.setTool)
  const color = useToolStore((s) => s.color)
  const setColor = useToolStore((s) => s.setColor)
  const strokeWidth = useToolStore((s) => s.strokeWidth)
  const setStrokeWidth = useToolStore((s) => s.setStrokeWidth)
  const selectedId = useToolStore((s) => s.selectedId)
  const selectedPageKey = useToolStore((s) => s.selectedPageKey)
  const clearSelection = useToolStore((s) => s.clearSelection)

  const selected: Annotation | undefined =
    selectedId && selectedPageKey
      ? tab.annotations[selectedPageKey]?.find((a) => a.id === selectedId)
      : undefined

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
  const deleteSelected = (): void => {
    if (selectedId && selectedPageKey) {
      removeAnnotation(tab.id, selectedPageKey, selectedId)
      clearSelection()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-card px-2 py-1">
      <div className="flex items-center gap-0.5">
        {TOOLS.map(({ tool: t, label, Icon }) => (
          <button
            key={t}
            type="button"
            title={label}
            aria-pressed={tool === t}
            onClick={() => setTool(t)}
            className={cn(
              'flex size-8 items-center justify-center rounded-md transition-colors',
              tool === t ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            )}
          >
            <Icon className="size-4" />
          </button>
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
              color === swatch
                ? 'ring-2 ring-ring ring-offset-1 ring-offset-background'
                : 'border-black/20'
            )}
            style={{ background: swatch }}
          />
        ))}
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

      <div className="ml-auto">
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
