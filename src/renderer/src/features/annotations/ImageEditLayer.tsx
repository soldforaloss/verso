import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useToolStore } from '@/store/toolStore'
import { getSource, useDocumentStore } from '@/store/documentStore'
import { pageRectToScreen, screenToPage } from '@/lib/annotationGeometry'
import type { Point, Rect } from '@/lib/annotations'
import type { PageViewport } from '@/lib/pdf'

/** Minimum image size in PDF points (keeps a resize from collapsing it). */
const MIN_SIZE = 8

type Corner = 'nw' | 'ne' | 'sw' | 'se'
type Gesture = { kind: 'move' | 'resize'; corner?: Corner; startRect: Rect; startPage: Point }
/** A selected image, tagged with the source revision its rect was measured against. */
type Selection = { rect: Rect; revision: number }

/** Smallest gesture (in PDF points) that counts as an intentional move/resize. */
const MOVE_EPSILON = 0.5

interface Props {
  docId: string
  pageKey: string
  viewport: PageViewport
  pageIndex: number
}

/** Normalizes a possibly-inverted rect to positive width/height, min-clamped. */
function normalize(rect: Rect): Rect {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x
  const y = rect.height < 0 ? rect.y + rect.height : rect.y
  return {
    x,
    y,
    width: Math.max(MIN_SIZE, Math.abs(rect.width)),
    height: Math.max(MIN_SIZE, Math.abs(rect.height))
  }
}

/** Applies a corner drag (page-space deltas) to a rect, keeping the opposite corner fixed. */
function resizeRect(rect: Rect, corner: Corner, dx: number, dy: number): Rect {
  const { x, y, width, height } = rect
  if (corner === 'sw') return { x: x + dx, y: y + dy, width: width - dx, height: height - dy }
  if (corner === 'se') return { x, y: y + dy, width: width + dx, height: height - dy }
  if (corner === 'nw') return { x: x + dx, y, width: width - dx, height: height + dy }
  return { x, y, width: width + dx, height: height + dy } // 'ne'
}

/**
 * Tier-3 in-place **image** editing. With the "Edit image" tool active, click an
 * image to select it (PDFium locate), then drag the box to move it, drag a
 * corner to resize, or press Delete / the trash button to remove it. Each edit
 * mutates the real content stream (via `pdfium:edit-image`) and is applied
 * eagerly with `replaceSource`, the same path OCR and true-text editing use.
 */
export function ImageEditLayer({
  docId,
  pageKey,
  viewport,
  pageIndex
}: Props): React.JSX.Element | null {
  const active = useToolStore((s) => s.tool === 'editimage')
  const containerRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [liveRect, setLiveRect] = useState<Rect | null>(null)

  // The tab's source revision — bumps whenever any source bytes are replaced
  // (OCR, redaction, true-text/image edits). A change invalidates a selection's
  // coordinates, so we drop stale handles reactively (below).
  const sourceRevision = useDocumentStore((s) => {
    const tab = s.tabs.find((t) => t.id === docId)
    const ref = tab?.pages.find((p) => p.key === pageKey)
    return tab && ref?.kind === 'source' ? tab.sourceRevision : -1
  })

  useEffect(() => {
    if (!active) {
      setSelection(null)
      setLiveRect(null)
    }
  }, [active])

  // If the underlying bytes change out from under a selection (another edit,
  // OCR, redaction), the box's coordinates no longer match — drop it. Our own
  // edits re-tag the selection with the post-edit revision, so this leaves them.
  useEffect(() => {
    if (selection && selection.revision !== sourceRevision) {
      setSelection(null)
      setLiveRect(null)
    }
  }, [selection, sourceRevision])

  const sourceContext = (): {
    tabId: string
    sourceId: string
    bytes: Uint8Array<ArrayBuffer>
    rotation: number
    revision: number
  } | null => {
    const tab = useDocumentStore.getState().tabs.find((t) => t.id === docId)
    const ref = tab?.pages.find((p) => p.key === pageKey)
    if (!tab || !ref || ref.kind !== 'source') return null
    const source = getSource(ref.sourceId)
    if (!source) return null
    return {
      tabId: tab.id,
      sourceId: ref.sourceId,
      bytes: source.bytes as Uint8Array<ArrayBuffer>,
      rotation: ref.rotation,
      revision: tab.sourceRevision
    }
  }

  const local = (event: React.PointerEvent): Point => {
    const rect = containerRef.current!.getBoundingClientRect()
    return screenToPage(viewport, event.clientX - rect.left, event.clientY - rect.top)
  }

  const cornerAt = (rect: Rect, p: Point): Corner | null => {
    const tol = 8 / viewport.scale
    const near = (cx: number, cy: number): boolean =>
      Math.abs(p.x - cx) <= tol && Math.abs(p.y - cy) <= tol
    if (near(rect.x, rect.y)) return 'sw'
    if (near(rect.x + rect.width, rect.y)) return 'se'
    if (near(rect.x, rect.y + rect.height)) return 'nw'
    if (near(rect.x + rect.width, rect.y + rect.height)) return 'ne'
    return null
  }

  const inRect = (rect: Rect, p: Point): boolean =>
    p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height

  const applyEdit = async (
    from: Selection,
    op: { kind: 'transform'; rect: Rect } | { kind: 'delete' }
  ): Promise<void> => {
    const ctx = sourceContext()
    // Bail if the bytes changed under the selection (OCR / another edit); the
    // rect no longer maps to the same image, so editing it would hit the wrong
    // object. Drop the stale handles instead.
    if (!ctx || ctx.revision !== from.revision) {
      setSelection(null)
      return
    }
    // Re-locate by the current image's centre, which is inside it in the live bytes.
    const cx = from.rect.x + from.rect.width / 2
    const cy = from.rect.y + from.rect.height / 2
    try {
      const bytes = await window.api.pdfiumEditImage({
        bytes: ctx.bytes,
        pageIndex,
        x: cx,
        y: cy,
        op:
          op.kind === 'transform'
            ? { kind: 'transform', rect: normalize(op.rect) }
            : { kind: 'delete' }
      })
      if (!bytes) return
      await useDocumentStore.getState().replaceSource(ctx.tabId, ctx.sourceId, bytes)
      // replaceSource bumped the revision — re-tag the surviving selection with
      // it so the reactive stale-drop above leaves our own edit's box in place.
      const next = sourceContext()
      setSelection(
        op.kind === 'transform' && next
          ? { rect: normalize(op.rect), revision: next.revision }
          : null
      )
    } catch {
      /* edit failed — leave the document unchanged */
    }
  }

  const onPointerDown = async (event: React.PointerEvent): Promise<void> => {
    if (!active) return
    event.preventDefault()
    const p = local(event)

    if (selection) {
      const corner = cornerAt(selection.rect, p)
      if (corner) {
        gestureRef.current = { kind: 'resize', corner, startRect: selection.rect, startPage: p }
        containerRef.current?.setPointerCapture(event.pointerId)
        return
      }
      if (inRect(selection.rect, p)) {
        gestureRef.current = { kind: 'move', startRect: selection.rect, startPage: p }
        containerRef.current?.setPointerCapture(event.pointerId)
        return
      }
    }

    // Select the image under the click (rotated pages / non-images clear it).
    const ctx = sourceContext()
    if (!ctx || ctx.rotation !== 0) {
      setSelection(null)
      return
    }
    try {
      const hit = await window.api.pdfiumLocateImage({
        bytes: ctx.bytes,
        pageIndex,
        x: p.x,
        y: p.y
      })
      setSelection(hit ? { rect: hit.rect, revision: ctx.revision } : null)
      setLiveRect(null)
    } catch {
      setSelection(null)
    }
  }

  const onPointerMove = (event: React.PointerEvent): void => {
    const g = gestureRef.current
    if (!g) return
    const p = local(event)
    const dx = p.x - g.startPage.x
    const dy = p.y - g.startPage.y
    setLiveRect(
      g.kind === 'move'
        ? { ...g.startRect, x: g.startRect.x + dx, y: g.startRect.y + dy }
        : resizeRect(g.startRect, g.corner!, dx, dy)
    )
  }

  const onPointerUp = async (event: React.PointerEvent): Promise<void> => {
    const g = gestureRef.current
    gestureRef.current = null
    containerRef.current?.releasePointerCapture?.(event.pointerId)
    const target = liveRect
    setLiveRect(null)
    if (!g || !target || !selection) return
    // Ignore a sub-pixel jitter: committing runs a full content-stream rewrite
    // (SetMatrix + GenerateContent + save) and dirties the document, so a
    // visually no-op nudge should do nothing.
    const cur = selection.rect
    const t = normalize(target)
    const moved =
      Math.abs(t.x - cur.x) > MOVE_EPSILON ||
      Math.abs(t.y - cur.y) > MOVE_EPSILON ||
      Math.abs(t.width - cur.width) > MOVE_EPSILON ||
      Math.abs(t.height - cur.height) > MOVE_EPSILON
    if (!moved) return
    await applyEdit(selection, { kind: 'transform', rect: target })
  }

  useEffect(() => {
    if (!active || !selection) return
    const onKey = (event: KeyboardEvent): void => {
      // Don't hijack Delete/Backspace while the user is typing in a field
      // (search box, page-number input, …) — that would silently delete the
      // image and swallow the keystroke the input expected.
      const t = event.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        void applyEdit(selection, { kind: 'delete' })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, selection])

  if (!active) return null

  const shown = liveRect ?? selection?.rect ?? null
  const screen = shown ? pageRectToScreen(viewport, shown) : null

  return (
    <div
      ref={containerRef}
      data-image-edit-layer
      className="absolute inset-0"
      style={{ zIndex: 4, pointerEvents: 'auto' }}
      onPointerDown={(event) => void onPointerDown(event)}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => void onPointerUp(event)}
    >
      {screen && (
        <div
          className="absolute border-2 border-blue-500"
          style={{
            left: screen.x,
            top: screen.y,
            width: screen.width,
            height: screen.height,
            pointerEvents: 'none'
          }}
        >
          {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((corner) => (
            <div
              key={corner}
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-blue-500"
              style={{
                left: corner.includes('w') ? 0 : '100%',
                top: corner.includes('n') ? 0 : '100%'
              }}
            />
          ))}
          {selection && !liveRect && (
            <button
              type="button"
              title="Delete image"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => selection && void applyEdit(selection, { kind: 'delete' })}
              className="absolute -right-2 -top-8 flex size-7 items-center justify-center rounded-md border bg-card text-destructive shadow-md hover:bg-accent"
              style={{ pointerEvents: 'auto' }}
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
