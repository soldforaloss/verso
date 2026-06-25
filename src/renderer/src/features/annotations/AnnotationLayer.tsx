import { useEffect, useRef, useState } from 'react'
import { Copy, Highlighter, Strikethrough, TextCursorInput, Underline } from 'lucide-react'
import { DRAWING_TOOLS, MARKUP_TOOLS, PLACING_TOOLS, useToolStore } from '@/store/toolStore'
import {
  addAnnotation,
  addAnnotations,
  removeAnnotation,
  updateAnnotation
} from '@/lib/annotationOps'
import {
  boundsOf,
  newAnnotationId,
  translateAnnotation,
  type Annotation,
  type MarkupKind,
  type Point,
  type Rect
} from '@/lib/annotations'
import {
  arrowHead,
  inkToScreenPath,
  normalizeRect,
  pageRectToScreen,
  pageToScreen,
  screenToPage
} from '@/lib/annotationGeometry'
import { OverlayContentEditor } from '@/lib/contentEditor'
import { estimateInkColor, hexToRgbTriple } from '@/lib/textStyle'
import { bundledFontByKey } from '@/lib/fonts'
import type { PageViewport, PdfDocument } from '@/lib/pdf'

const contentEditor = new OverlayContentEditor()

// A reused offscreen context for measuring substitute-font text widths (points).
const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
const measureCtx = measureCanvas?.getContext('2d') ?? null

function measureTextWidth(
  text: string,
  fontSize: number,
  cssFamily: string,
  bold: boolean,
  italic: boolean
): number {
  if (!measureCtx) return 0
  const weight = bold ? 'bold ' : ''
  const slant = italic ? 'italic ' : ''
  measureCtx.font = `${slant}${weight}${fontSize}px ${cssFamily}`
  return measureCtx.measureText(text).width
}

interface Props {
  docId: string
  pageKey: string
  viewport: PageViewport
  annotations: Annotation[]
  /** Source document + page index — needed for cover-&-replace text editing. */
  pdf: PdfDocument
  pageIndex: number
}

type Gesture =
  | { kind: 'move'; id: string; startPage: Point; original: Annotation }
  | { kind: 'resize-rect'; id: string; corner: Corner; original: RectAnnotation }
  | { kind: 'resize-line'; id: string; end: 'a' | 'b'; original: LineAnnotation }

type Corner = 'nw' | 'ne' | 'sw' | 'se'
type RectAnnotation = Extract<Annotation, { rect: Rect }>
type LineAnnotation = Extract<Annotation, { type: 'line' }>

const MIN_SIZE = 6

export function AnnotationLayer({
  docId,
  pageKey,
  viewport,
  annotations,
  pdf,
  pageIndex
}: Props): React.JSX.Element {
  const tool = useToolStore((s) => s.tool)
  const color = useToolStore((s) => s.color)
  const strokeWidth = useToolStore((s) => s.strokeWidth)
  const fontSize = useToolStore((s) => s.fontSize)
  const fontFamily = useToolStore((s) => s.fontFamily)
  const bold = useToolStore((s) => s.bold)
  const italic = useToolStore((s) => s.italic)
  const letterSpacing = useToolStore((s) => s.letterSpacing)
  const selectedId = useToolStore((s) => (s.selectedPageKey === pageKey ? s.selectedId : null))
  const selectAnnotation = useToolStore((s) => s.selectAnnotation)

  const containerRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Annotation | null>(null)
  const [live, setLive] = useState<Annotation | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ centerX: number; top: number } | null>(null)
  const createStart = useRef<Point | null>(null)
  const gestureRef = useRef<Gesture | null>(null)

  const width = viewport.width
  const height = viewport.height
  const isDrawing = DRAWING_TOOLS.has(tool)
  const isPlacing = PLACING_TOOLS.has(tool)
  const isMarkup = MARKUP_TOOLS.has(tool)
  const interactive = tool === 'select' || tool === 'eraser'

  const local = (event: React.PointerEvent): Point => {
    const rect = containerRef.current!.getBoundingClientRect()
    return screenToPage(viewport, event.clientX - rect.left, event.clientY - rect.top)
  }

  // Builds markup quads from the current text selection and adds the annotation.
  const applyMarkup = (markup: MarkupKind): void => {
    const selection = window.getSelection()
    const container = containerRef.current
    if (!selection || selection.isCollapsed || !container) return
    // The text layer is a sibling of this overlay, so test against the page.
    if (!container.parentElement?.contains(selection.anchorNode)) return
    const base = container.getBoundingClientRect()
    const quads: Rect[] = []
    for (const r of Array.from(selection.getRangeAt(0).getClientRects())) {
      if (r.width <= 0) continue
      const p1 = screenToPage(viewport, r.left - base.left, r.top - base.top)
      const p2 = screenToPage(viewport, r.right - base.left, r.bottom - base.top)
      quads.push(normalizeRect({ x: p1.x, y: p1.y, width: p2.x - p1.x, height: p2.y - p1.y }))
    }
    if (quads.length === 0) return
    addAnnotation(docId, {
      id: newAnnotationId(),
      pageKey,
      type: 'markup',
      markup,
      color,
      opacity: markup === 'highlight' ? 0.4 : 1,
      quads
    })
    selection.removeAllRanges()
    setSelectionBox(null)
  }

  // With a markup tool active, selecting text immediately applies that markup.
  useEffect(() => {
    if (!isMarkup) return
    const onMouseUp = (): void => applyMarkup(tool as MarkupKind)
    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMarkup, tool, color, viewport, docId, pageKey])

  // In select mode, a text selection raises a floating action popover so you can
  // highlight or start editing without first picking a tool.
  useEffect(() => {
    if (tool !== 'select') {
      setSelectionBox(null)
      return
    }
    const update = (): void => {
      const selection = window.getSelection()
      const container = containerRef.current
      if (
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0 ||
        !container ||
        !container.parentElement?.contains(selection.anchorNode)
      ) {
        setSelectionBox(null)
        return
      }
      const rects = Array.from(selection.getRangeAt(0).getClientRects()).filter((r) => r.width > 0)
      if (rects.length === 0) {
        setSelectionBox(null)
        return
      }
      const base = container.getBoundingClientRect()
      const left = Math.min(...rects.map((r) => r.left)) - base.left
      const right = Math.max(...rects.map((r) => r.right)) - base.left
      const top = Math.min(...rects.map((r) => r.top)) - base.top
      setSelectionBox({ centerX: (left + right) / 2, top })
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [tool])

  // Samples a hex background color from the rendered page canvas for a page rect.
  const sampleBackground = (pageRect: Rect): string => {
    try {
      const canvas = containerRef.current?.parentElement?.querySelector('canvas')
      if (!(canvas instanceof HTMLCanvasElement)) return '#ffffff'
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return '#ffffff'
      const top = pageToScreen(viewport, { x: pageRect.x, y: pageRect.y + pageRect.height })
      const dpr = window.devicePixelRatio || 1
      const sx = Math.max(0, Math.round((top.x + 2) * dpr))
      const sy = Math.max(0, Math.round((top.y - 3) * dpr))
      const [r, g, b] = ctx.getImageData(sx, sy, 1, 1).data
      return `#${[r ?? 255, g ?? 255, b ?? 255].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    } catch {
      return '#ffffff'
    }
  }

  // Estimates the ink (text) color of a run by reading its rendered pixels and
  // weighting them away from the sampled background — so cover-&-replace text
  // keeps the original color instead of defaulting to black.
  const sampleInkColor = (pageRect: Rect): string => {
    const fallback = '#111111'
    try {
      const canvas = containerRef.current?.parentElement?.querySelector('canvas')
      if (!(canvas instanceof HTMLCanvasElement)) return fallback
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return fallback
      const screen = pageRectToScreen(viewport, pageRect)
      const dpr = window.devicePixelRatio || 1
      const sx = Math.max(0, Math.round(screen.x * dpr))
      const sy = Math.max(0, Math.round(screen.y * dpr))
      const sw = Math.min(Math.max(1, Math.round(screen.width * dpr)), canvas.width - sx)
      const sh = Math.min(Math.max(1, Math.round(screen.height * dpr)), canvas.height - sy)
      if (sw <= 0 || sh <= 0) return fallback
      const background = hexToRgbTriple(sampleBackground(pageRect))
      const { data } = ctx.getImageData(sx, sy, sw, sh)
      return estimateInkColor(data, background) ?? fallback
    } catch {
      return fallback
    }
  }

  // Tier 2 cover-&-replace: edit the existing text run under the click.
  const editTextRunAt = async (point: Point): Promise<void> => {
    const page = await pdf.getPage(pageIndex + 1)
    const created = await contentEditor.editTextRun({
      page,
      pageKey,
      point,
      sampleBackground,
      sampleInkColor,
      measureTextWidth
    })
    if (!created) return
    addAnnotations(docId, created, 'Edit text')
    const textAnnotation = created[created.length - 1]
    // setTool clears the selection, so select the new text box afterwards.
    useToolStore.getState().setTool('select')
    if (textAnnotation) selectAnnotation(pageKey, textAnnotation.id)
  }

  // Starts a cover-&-replace edit on the run under the current text selection.
  const editSelection = (): void => {
    const selection = window.getSelection()
    const container = containerRef.current
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !container) return
    const first = Array.from(selection.getRangeAt(0).getClientRects()).find((r) => r.width > 0)
    if (!first) return
    const base = container.getBoundingClientRect()
    const point = screenToPage(
      viewport,
      (first.left + first.right) / 2 - base.left,
      (first.top + first.bottom) / 2 - base.top
    )
    selection.removeAllRanges()
    setSelectionBox(null)
    void editTextRunAt(point)
  }

  const copySelection = (): void => {
    const text = window.getSelection()?.toString() ?? ''
    if (text) void navigator.clipboard?.writeText(text).catch(() => {})
    setSelectionBox(null)
  }

  // Double-clicking a run in select mode edits it directly (fastest path).
  const editTextRunRef = useRef(editTextRunAt)
  useEffect(() => {
    editTextRunRef.current = editTextRunAt
  })
  useEffect(() => {
    if (tool !== 'select') return
    const onDoubleClick = (event: MouseEvent): void => {
      const container = containerRef.current
      const target = event.target as HTMLElement | null
      // Ignore double-clicks on existing annotations / their editors.
      if (!container || target?.closest('textarea, input, svg')) return
      const base = container.getBoundingClientRect()
      if (
        event.clientX < base.left ||
        event.clientX > base.right ||
        event.clientY < base.top ||
        event.clientY > base.bottom
      ) {
        return
      }
      window.getSelection()?.removeAllRanges()
      setSelectionBox(null)
      void editTextRunRef.current(
        screenToPage(viewport, event.clientX - base.left, event.clientY - base.top)
      )
    }
    document.addEventListener('dblclick', onDoubleClick)
    return () => document.removeEventListener('dblclick', onDoubleClick)
  }, [tool, viewport])

  // ---- Create gestures (container captures pointer for drawing / placing) ----
  const onContainerDown = (event: React.PointerEvent): void => {
    if (tool === 'edittext') {
      event.preventDefault()
      void editTextRunAt(local(event))
      return
    }
    if (!isDrawing && !isPlacing) return
    event.preventDefault()
    const p = local(event)
    containerRef.current?.setPointerCapture(event.pointerId)
    createStart.current = p

    if (tool === 'ink') {
      setDraft({
        id: newAnnotationId(),
        pageKey,
        type: 'ink',
        color,
        opacity: 1,
        strokeWidth,
        strokes: [[p]]
      })
    } else if (tool === 'rect' || tool === 'ellipse') {
      setDraft({
        id: newAnnotationId(),
        pageKey,
        type: tool,
        color,
        opacity: 1,
        strokeWidth,
        filled: false,
        rect: { x: p.x, y: p.y, width: 0, height: 0 }
      })
    } else if (tool === 'redaction') {
      setDraft({
        id: newAnnotationId(),
        pageKey,
        type: 'redaction',
        color: '#000000',
        opacity: 1,
        rect: { x: p.x, y: p.y, width: 0, height: 0 }
      })
    } else if (tool === 'line' || tool === 'arrow') {
      setDraft({
        id: newAnnotationId(),
        pageKey,
        type: 'line',
        color,
        opacity: 1,
        strokeWidth,
        arrow: tool === 'arrow',
        a: p,
        b: p
      })
    } else if (tool === 'text') {
      const annotation: Annotation = {
        id: newAnnotationId(),
        pageKey,
        type: 'text',
        color,
        opacity: 1,
        fontSize,
        fontFamily,
        bold,
        italic,
        letterSpacing,
        text: 'Text',
        rect: { x: p.x, y: p.y - 24, width: 160, height: 24 }
      }
      addAnnotation(docId, annotation)
      useToolStore.getState().setTool('select')
      selectAnnotation(pageKey, annotation.id)
    } else if (tool === 'note') {
      const annotation: Annotation = {
        id: newAnnotationId(),
        pageKey,
        type: 'note',
        color,
        opacity: 1,
        point: p,
        text: ''
      }
      addAnnotation(docId, annotation)
      useToolStore.getState().setTool('select')
      selectAnnotation(pageKey, annotation.id)
    }
  }

  const onContainerMove = (event: React.PointerEvent): void => {
    const start = createStart.current
    if (!start || !draft) return
    const p = local(event)
    if (draft.type === 'ink') {
      setDraft({ ...draft, strokes: [[...draft.strokes[0]!, p]] })
    } else if (draft.type === 'rect' || draft.type === 'ellipse' || draft.type === 'redaction') {
      setDraft({
        ...draft,
        rect: normalizeRect({ x: start.x, y: start.y, width: p.x - start.x, height: p.y - start.y })
      })
    } else if (draft.type === 'line') {
      setDraft({ ...draft, b: p })
    }
  }

  const onContainerUp = (event: React.PointerEvent): void => {
    containerRef.current?.releasePointerCapture(event.pointerId)
    createStart.current = null
    const annotation = draft
    setDraft(null)
    if (!annotation) return
    const bounds = boundsOf(annotation)
    const tooSmall =
      annotation.type === 'ink'
        ? annotation.strokes[0]!.length < 2
        : bounds.width < MIN_SIZE && bounds.height < MIN_SIZE
    if (!tooSmall) addAnnotation(docId, annotation)
  }

  // ---- Move / resize gestures on existing annotations (select mode) ----
  const startMove = (event: React.PointerEvent, annotation: Annotation): void => {
    if (tool === 'eraser') {
      removeAnnotation(docId, pageKey, annotation.id)
      return
    }
    if (tool !== 'select') return
    event.stopPropagation()
    selectAnnotation(pageKey, annotation.id)
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
    gestureRef.current = {
      kind: 'move',
      id: annotation.id,
      startPage: local(event),
      original: annotation
    }
    setLive(annotation)
  }

  const startResizeRect = (
    event: React.PointerEvent,
    annotation: RectAnnotation,
    corner: Corner
  ): void => {
    event.stopPropagation()
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
    gestureRef.current = { kind: 'resize-rect', id: annotation.id, corner, original: annotation }
    setLive(annotation)
  }

  const startResizeLine = (
    event: React.PointerEvent,
    annotation: LineAnnotation,
    end: 'a' | 'b'
  ): void => {
    event.stopPropagation()
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
    gestureRef.current = { kind: 'resize-line', id: annotation.id, end, original: annotation }
    setLive(annotation)
  }

  const onGestureMove = (event: React.PointerEvent): void => {
    const gesture = gestureRef.current
    if (!gesture) return
    const p = local(event)
    if (gesture.kind === 'move') {
      setLive(
        translateAnnotation(gesture.original, p.x - gesture.startPage.x, p.y - gesture.startPage.y)
      )
    } else if (gesture.kind === 'resize-rect') {
      const r = gesture.original.rect
      const right = r.x + r.width
      const top = r.y + r.height
      const x0 = gesture.corner === 'nw' || gesture.corner === 'sw' ? p.x : r.x
      const y0 = gesture.corner === 'sw' || gesture.corner === 'se' ? p.y : r.y
      const x1 = gesture.corner === 'ne' || gesture.corner === 'se' ? p.x : right
      const y1 = gesture.corner === 'nw' || gesture.corner === 'ne' ? p.y : top
      setLive({
        ...gesture.original,
        rect: normalizeRect({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 })
      })
    } else {
      setLive({ ...gesture.original, [gesture.end]: p })
    }
  }

  const onGestureUp = (event: React.PointerEvent): void => {
    const gesture = gestureRef.current
    gestureRef.current = null
    ;(event.currentTarget as Element).releasePointerCapture?.(event.pointerId)
    const finalAnnotation = live
    setLive(null)
    if (gesture && finalAnnotation) {
      updateAnnotation(
        docId,
        finalAnnotation,
        gesture.kind === 'move' ? 'Move annotation' : 'Resize annotation'
      )
    }
  }

  const rendered = annotations.map((a) => (a.id === live?.id ? live : a))
  const all = draft ? [...rendered, draft] : rendered

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        width,
        height,
        zIndex: 3,
        pointerEvents: isDrawing || isPlacing || tool === 'edittext' ? 'auto' : 'none'
      }}
      onPointerDown={onContainerDown}
      onPointerMove={onContainerMove}
      onPointerUp={onContainerUp}
    >
      {selectionBox && tool === 'select' && (
        <div
          className="absolute z-20 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-md border bg-card p-0.5 shadow-md"
          style={{ left: selectionBox.centerX, top: selectionBox.top - 8, pointerEvents: 'auto' }}
          onPointerDown={(event) => event.preventDefault()}
        >
          {(
            [
              { title: 'Highlight', icon: Highlighter, onClick: () => applyMarkup('highlight') },
              { title: 'Underline', icon: Underline, onClick: () => applyMarkup('underline') },
              { title: 'Strikethrough', icon: Strikethrough, onClick: () => applyMarkup('strike') }
            ] as const
          ).map(({ title, icon: Icon, onClick }) => (
            <button
              key={title}
              type="button"
              title={title}
              onClick={onClick}
              className="flex size-7 items-center justify-center rounded hover:bg-accent"
            >
              <Icon className="size-4" />
            </button>
          ))}
          <div className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            title="Edit text"
            onClick={editSelection}
            className="flex size-7 items-center justify-center rounded hover:bg-accent"
          >
            <TextCursorInput className="size-4" />
          </button>
          <button
            type="button"
            title="Copy"
            onClick={copySelection}
            className="flex size-7 items-center justify-center rounded hover:bg-accent"
          >
            <Copy className="size-4" />
          </button>
        </div>
      )}
      <svg width={width} height={height} className="absolute inset-0 overflow-visible">
        {all.map((annotation) =>
          renderVector(annotation, {
            viewport,
            selected: annotation.id === selectedId,
            interactive,
            onPointerDown: (e) => startMove(e, annotation),
            onPointerMove: onGestureMove,
            onPointerUp: onGestureUp,
            startResizeRect,
            startResizeLine
          })
        )}
      </svg>
      {all
        .filter((a) => a.type === 'text' || a.type === 'note' || a.type === 'image')
        .map((annotation) => (
          <HtmlAnnotation
            key={annotation.id}
            annotation={annotation}
            viewport={viewport}
            selected={annotation.id === selectedId}
            editable={tool === 'select'}
            interactive={interactive}
            docId={docId}
            onPointerDown={(e) => startMove(e, annotation)}
            onPointerMove={onGestureMove}
            onPointerUp={onGestureUp}
            startResizeRect={startResizeRect}
          />
        ))}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Rendering helpers
// ----------------------------------------------------------------------------

interface VectorContext {
  viewport: PageViewport
  selected: boolean
  interactive: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  startResizeRect: (e: React.PointerEvent, a: RectAnnotation, corner: Corner) => void
  startResizeLine: (e: React.PointerEvent, a: LineAnnotation, end: 'a' | 'b') => void
}

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']

function renderVector(annotation: Annotation, ctx: VectorContext): React.JSX.Element | null {
  const { viewport, selected, interactive } = ctx
  const hitProps = interactive
    ? {
        onPointerDown: ctx.onPointerDown,
        onPointerMove: ctx.onPointerMove,
        onPointerUp: ctx.onPointerUp,
        style: { pointerEvents: 'auto' as const, cursor: 'move' }
      }
    : { style: { pointerEvents: 'none' as const } }

  const selectionChrome = (): React.JSX.Element | null => {
    if (!selected) return null
    const b = pageRectToScreen(viewport, boundsOf(annotation))
    return (
      <rect
        x={b.x - 3}
        y={b.y - 3}
        width={b.width + 6}
        height={b.height + 6}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={1}
        strokeDasharray="4 3"
        pointerEvents="none"
      />
    )
  }

  if (annotation.type === 'ink') {
    return (
      <g key={annotation.id}>
        <path
          d={inkToScreenPath(viewport, annotation.strokes)}
          fill="none"
          stroke={annotation.color}
          strokeWidth={annotation.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={annotation.opacity}
        />
        {interactive && (
          <path
            d={inkToScreenPath(viewport, annotation.strokes)}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(annotation.strokeWidth + 8, 12)}
            {...hitProps}
          />
        )}
        {selectionChrome()}
      </g>
    )
  }

  if (annotation.type === 'rect') {
    const r = pageRectToScreen(viewport, annotation.rect)
    return (
      <g key={annotation.id}>
        <rect
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill={annotation.filled ? annotation.color : 'none'}
          fillOpacity={annotation.filled ? annotation.opacity : 0}
          stroke={annotation.color}
          strokeWidth={annotation.strokeWidth}
          opacity={annotation.opacity}
          {...hitProps}
        />
        {selectionChrome()}
        {selected && resizeHandles(r, (e, corner) => ctx.startResizeRect(e, annotation, corner))}
      </g>
    )
  }

  if (annotation.type === 'ellipse') {
    const r = pageRectToScreen(viewport, annotation.rect)
    return (
      <g key={annotation.id}>
        <ellipse
          cx={r.x + r.width / 2}
          cy={r.y + r.height / 2}
          rx={r.width / 2}
          ry={r.height / 2}
          fill={annotation.filled ? annotation.color : 'none'}
          fillOpacity={annotation.filled ? annotation.opacity : 0}
          stroke={annotation.color}
          strokeWidth={annotation.strokeWidth}
          opacity={annotation.opacity}
          {...hitProps}
        />
        {selectionChrome()}
        {selected && resizeHandles(r, (e, corner) => ctx.startResizeRect(e, annotation, corner))}
      </g>
    )
  }

  if (annotation.type === 'line') {
    const a = pageToScreen(viewport, annotation.a)
    const b = pageToScreen(viewport, annotation.b)
    const heads = annotation.arrow ? arrowHead(a, b) : null
    return (
      <g key={annotation.id}>
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={annotation.color}
          strokeWidth={annotation.strokeWidth}
          opacity={annotation.opacity}
          strokeLinecap="round"
        />
        {heads && (
          <>
            <line
              x1={b.x}
              y1={b.y}
              x2={heads[0].x}
              y2={heads[0].y}
              stroke={annotation.color}
              strokeWidth={annotation.strokeWidth}
              strokeLinecap="round"
            />
            <line
              x1={b.x}
              y1={b.y}
              x2={heads[1].x}
              y2={heads[1].y}
              stroke={annotation.color}
              strokeWidth={annotation.strokeWidth}
              strokeLinecap="round"
            />
          </>
        )}
        {interactive && (
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="transparent"
            strokeWidth={Math.max(annotation.strokeWidth + 8, 12)}
            {...hitProps}
          />
        )}
        {selected && (
          <>
            {endpointHandle(a, (e) => ctx.startResizeLine(e, annotation, 'a'))}
            {endpointHandle(b, (e) => ctx.startResizeLine(e, annotation, 'b'))}
          </>
        )}
      </g>
    )
  }

  if (annotation.type === 'redaction') {
    const r = pageRectToScreen(viewport, annotation.rect)
    return (
      <g key={annotation.id}>
        <rect
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill="#000000"
          stroke="#dc2626"
          strokeWidth={1}
          {...hitProps}
        />
        {selectionChrome()}
        {selected && resizeHandles(r, (e, corner) => ctx.startResizeRect(e, annotation, corner))}
      </g>
    )
  }

  if (annotation.type === 'markup') {
    return (
      <g key={annotation.id}>
        {annotation.quads.map((quad, index) => {
          const r = pageRectToScreen(viewport, quad)
          if (annotation.markup === 'highlight') {
            return (
              <rect
                key={index}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill={annotation.color}
                opacity={annotation.opacity}
                {...(index === 0 ? hitProps : {})}
              />
            )
          }
          const y = annotation.markup === 'strike' ? r.y + r.height / 2 : r.y + r.height - 1
          if (annotation.markup === 'squiggly') {
            return (
              <path
                key={index}
                d={squigglyPath(r.x, y, r.width)}
                fill="none"
                stroke={annotation.color}
                strokeWidth={1.2}
                {...(index === 0 ? hitProps : {})}
              />
            )
          }
          return (
            <line
              key={index}
              x1={r.x}
              y1={y}
              x2={r.x + r.width}
              y2={y}
              stroke={annotation.color}
              strokeWidth={1.5}
              {...(index === 0 ? hitProps : {})}
            />
          )
        })}
        {selectionChrome()}
      </g>
    )
  }

  return null
}

function resizeHandles(
  r: Rect,
  onStart: (e: React.PointerEvent, corner: Corner) => void
): React.JSX.Element {
  const pos: Record<Corner, { x: number; y: number }> = {
    nw: { x: r.x, y: r.y },
    ne: { x: r.x + r.width, y: r.y },
    sw: { x: r.x, y: r.y + r.height },
    se: { x: r.x + r.width, y: r.y + r.height }
  }
  return (
    <>
      {CORNERS.map((corner) => (
        <rect
          key={corner}
          x={pos[corner].x - 4}
          y={pos[corner].y - 4}
          width={8}
          height={8}
          fill="#3b82f6"
          style={{ pointerEvents: 'auto', cursor: 'nwse-resize' }}
          onPointerDown={(e) => onStart(e, corner)}
        />
      ))}
    </>
  )
}

function endpointHandle(
  p: { x: number; y: number },
  onStart: (e: React.PointerEvent) => void
): React.JSX.Element {
  return (
    <circle
      cx={p.x}
      cy={p.y}
      r={5}
      fill="#3b82f6"
      style={{ pointerEvents: 'auto', cursor: 'move' }}
      onPointerDown={onStart}
    />
  )
}

function squigglyPath(x: number, y: number, width: number): string {
  const step = 4
  let d = `M ${x} ${y}`
  for (let offset = 0; offset < width; offset += step) {
    const up = (offset / step) % 2 === 0
    d += ` L ${x + offset + step} ${y + (up ? -2 : 2)}`
  }
  return d
}

interface HtmlProps {
  annotation: Annotation
  viewport: PageViewport
  selected: boolean
  editable: boolean
  interactive: boolean
  docId: string
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  startResizeRect: (e: React.PointerEvent, a: RectAnnotation, corner: Corner) => void
}

const HTML_CORNERS: [Corner, React.CSSProperties][] = [
  ['nw', { left: -4, top: -4 }],
  ['ne', { right: -4, top: -4 }],
  ['sw', { left: -4, bottom: -4 }],
  ['se', { right: -4, bottom: -4 }]
]

function htmlResizeHandles(
  annotation: RectAnnotation,
  onStart: (e: React.PointerEvent, a: RectAnnotation, corner: Corner) => void
): React.JSX.Element {
  return (
    <>
      {HTML_CORNERS.map(([corner, pos]) => (
        <div
          key={corner}
          onPointerDown={(e) => onStart(e, annotation, corner)}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            background: '#3b82f6',
            cursor: 'nwse-resize',
            pointerEvents: 'auto',
            ...pos
          }}
        />
      ))}
    </>
  )
}

function HtmlAnnotation({
  annotation,
  viewport,
  selected,
  editable,
  interactive,
  docId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  startResizeRect
}: HtmlProps): React.JSX.Element | null {
  if (annotation.type === 'text') {
    const r = pageRectToScreen(viewport, annotation.rect)
    return (
      <div
        className="absolute"
        style={{
          left: r.x,
          top: r.y,
          width: r.width,
          minHeight: r.height,
          pointerEvents: interactive ? 'auto' : 'none',
          outline: selected ? '1px dashed #3b82f6' : 'none'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <textarea
          key={annotation.id}
          defaultValue={annotation.text}
          readOnly={!editable}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            if (e.target.value !== annotation.text) {
              updateAnnotation(docId, { ...annotation, text: e.target.value }, 'Edit text')
            }
          }}
          className="size-full resize-none border-none bg-transparent leading-tight outline-none"
          style={{
            // Scale point sizes by the zoom so the editable preview matches the
            // rendered page (the overlay box is already in scaled screen px).
            color: annotation.color,
            opacity: annotation.opacity,
            fontSize: annotation.fontSize * viewport.scale,
            fontFamily:
              bundledFontByKey(annotation.fontKey)?.family ?? annotation.fontFamily ?? 'sans-serif',
            fontWeight: annotation.bold ? 'bold' : 'normal',
            fontStyle: annotation.italic ? 'italic' : 'normal',
            letterSpacing: `${(annotation.letterSpacing ?? 0) * viewport.scale}px`
          }}
        />
        {selected && htmlResizeHandles(annotation, startResizeRect)}
      </div>
    )
  }

  if (annotation.type === 'image') {
    const r = pageRectToScreen(viewport, annotation.rect)
    return (
      <div
        className="absolute"
        style={{
          left: r.x,
          top: r.y,
          width: r.width,
          height: r.height,
          pointerEvents: interactive ? 'auto' : 'none',
          outline: selected ? '1px dashed #3b82f6' : 'none'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img src={annotation.dataUrl} alt="" draggable={false} className="size-full select-none" />
        {selected && htmlResizeHandles(annotation, startResizeRect)}
      </div>
    )
  }

  if (annotation.type === 'note') {
    const p = pageToScreen(viewport, annotation.point)
    return (
      <div
        className="absolute flex size-[18px] items-center justify-center rounded-sm text-[11px] text-white shadow"
        style={{
          left: p.x,
          top: p.y - 18,
          background: annotation.color,
          pointerEvents: interactive ? 'auto' : 'none',
          outline: selected ? '2px solid #3b82f6' : 'none'
        }}
        title={annotation.text || 'Note'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        ✎
      </div>
    )
  }

  return null
}
