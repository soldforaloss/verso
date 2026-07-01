import { useRef, useState } from 'react'
import { Bold, Italic, Type } from 'lucide-react'
import { ANNOTATION_COLORS, type Rect } from '@/lib/annotations'
import { cn } from '@/lib/utils'
import type { FontFamily } from '@shared/ipc'

/** The editable style of a true text edit (mirrors the located object style). */
export interface EditorStyle {
  sizePt: number
  colorHex: string
  bold: boolean
  italic: boolean
  family: FontFamily
}

interface Props {
  /** The object's rect in screen space (already scaled + positioned). */
  screenRect: Rect
  /** Viewport scale (screen px per PDF point) — sizes the preview text. */
  scale: number
  initialText: string
  initialStyle: EditorStyle
  onCommit: (text: string, style: EditorStyle) => void
  onCancel: () => void
}

const FAMILIES: readonly { value: FontFamily; label: string }[] = [
  { value: 'sans-serif', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Mono' }
]

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

/**
 * The Tier-3 true-text inline editor: a floating input over the real content-
 * stream text object, plus a compact style toolbar (size, bold, italic, colour,
 * family). Editing here maps to genuine PDFium object edits on commit — the
 * preview is rendered in the chosen style so what you see matches the result.
 *
 * Focus model: the whole editor lives in one container. Committing happens on
 * Enter or when focus leaves the container entirely (click elsewhere); toolbar
 * clicks keep the text input focused (`onMouseDown` preventDefault) so they
 * never trigger a premature commit. Escape cancels.
 */
export function TrueTextEditor({
  screenRect,
  scale,
  initialText,
  initialStyle,
  onCommit,
  onCancel
}: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLInputElement>(null)
  const [style, setStyle] = useState<EditorStyle>(initialStyle)
  const committed = useRef(false)

  const commit = (): void => {
    if (committed.current) return
    committed.current = true
    onCommit(textRef.current?.value ?? initialText, style)
  }
  const cancel = (): void => {
    if (committed.current) return
    committed.current = true
    onCancel()
  }

  // Commit when focus moves to a real element OUTSIDE the editor. A null
  // relatedTarget means focus left to a non-DOM surface (the native colour
  // picker, another OS window) — committing there would close the editor out from
  // under the user mid-interaction, so we only commit on a genuine outside focus.
  const onContainerBlur = (event: React.FocusEvent): void => {
    const next = event.relatedTarget as Node | null
    if (next && !containerRef.current?.contains(next)) commit()
  }

  const previewFontSize = Math.max(8, style.sizePt * scale)
  // Keep the toolbar within the page: above the text unless too close to the top.
  const toolbarBelow = screenRect.y < 44

  return (
    <div
      ref={containerRef}
      onBlur={onContainerBlur}
      className="absolute z-30"
      style={{ left: screenRect.x, top: screenRect.y, pointerEvents: 'auto' }}
    >
      <input
        ref={textRef}
        data-true-text-editor
        autoFocus
        defaultValue={initialText}
        spellCheck={false}
        onFocus={(event) => event.target.select()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
          }
        }}
        className="rounded-sm border border-blue-500 bg-white px-0.5 leading-none text-black shadow-sm outline-none"
        style={{
          width: Math.max(screenRect.width + 12, 32),
          height: Math.max(screenRect.height, 16),
          fontSize: previewFontSize,
          color: style.colorHex,
          fontWeight: style.bold ? 700 : 400,
          fontStyle: style.italic ? 'italic' : 'normal',
          fontFamily: style.family
        }}
      />
      <div
        data-true-text-toolbar
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          'absolute left-0 flex items-center gap-1 rounded-md border bg-card px-2 py-1 shadow-md',
          toolbarBelow ? 'top-full mt-1' : 'bottom-full mb-1'
        )}
      >
        <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Font size">
          <Type className="size-3.5" />
          <input
            type="number"
            defaultValue={Math.round(style.sizePt)}
            min={4}
            max={400}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              const n = Number.parseFloat(event.target.value)
              if (Number.isFinite(n))
                setStyle((s) => ({ ...s, sizePt: Math.max(4, Math.min(400, n)) }))
            }}
            className="w-12 rounded border bg-background px-1 py-0.5 text-xs text-foreground"
          />
        </label>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <button
          type="button"
          title="Bold"
          aria-pressed={style.bold}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setStyle((s) => ({ ...s, bold: !s.bold }))}
          className={cn(
            'flex size-7 items-center justify-center rounded-md transition-colors',
            style.bold ? 'bg-secondary' : 'hover:bg-accent'
          )}
        >
          <Bold className="size-4" />
        </button>
        <button
          type="button"
          title="Italic"
          aria-pressed={style.italic}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setStyle((s) => ({ ...s, italic: !s.italic }))}
          className={cn(
            'flex size-7 items-center justify-center rounded-md transition-colors',
            style.italic ? 'bg-secondary' : 'hover:bg-accent'
          )}
        >
          <Italic className="size-4" />
        </button>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <div className="flex items-center rounded-md border p-0.5">
          {FAMILIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              title={`${label} font`}
              aria-pressed={style.family === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setStyle((s) => ({ ...s, family: value }))}
              className={cn(
                'rounded-[5px] px-1.5 py-0.5 text-xs transition-colors',
                value === 'serif' && 'font-serif',
                value === 'monospace' && 'font-mono',
                style.family === value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <div className="flex items-center gap-1">
          {ANNOTATION_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              title={swatch}
              aria-label={`Color ${swatch}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setStyle((s) => ({ ...s, colorHex: swatch }))}
              className={cn(
                'size-5 rounded-full border',
                style.colorHex.toLowerCase() === swatch
                  ? 'ring-2 ring-ring ring-offset-1 ring-offset-background'
                  : 'border-black/20'
              )}
              style={{ background: swatch }}
            />
          ))}
          <label
            title="Custom color"
            className="relative size-5 cursor-pointer overflow-hidden rounded-full border border-black/20"
            style={{ background: style.colorHex }}
          >
            <input
              type="color"
              aria-label="Custom color"
              value={COLOR_RE.test(style.colorHex) ? style.colorHex : '#000000'}
              onMouseDown={(event) => event.stopPropagation()}
              onChange={(event) => setStyle((s) => ({ ...s, colorHex: event.target.value }))}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
