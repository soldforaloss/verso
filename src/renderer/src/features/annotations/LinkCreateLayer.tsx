import { useRef, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import type { PageViewport } from '@/lib/pdf'
import { pageRectToScreen, screenToPage } from '@/lib/annotationGeometry'
import { useToolStore } from '@/store/toolStore'
import { addLink, removeLink, updateLinkUrl } from '@/lib/linkOps'
import { newLinkId, sanitizeUrl, type PageLink } from '@/lib/links'

interface DraftRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Overlay for authoring clickable hyperlinks: when the link tool is active, drag
 * a rectangle to create a link hotspot and type its URL inline. Existing links
 * render as labelled previews (invalid URLs flagged amber) and can be deleted.
 * The real `/Link` annotation is written on save. When the link tool is inactive
 * the overlay is entirely pass-through so other tools reach the layers beneath.
 */
export function LinkCreateLayer({
  viewport,
  docId,
  pageKey,
  links
}: {
  viewport: PageViewport
  docId: string
  pageKey: string
  links: PageLink[]
}): React.JSX.Element {
  const tool = useToolStore((s) => s.tool)
  const isLinkTool = tool === 'link'
  const containerRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState<DraftRect | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftUrl, setDraftUrl] = useState('')
  // Set when Escape cancels an edit so the resulting blur doesn't commit it.
  const cancelEdit = useRef(false)

  const localPoint = (event: React.PointerEvent): { x: number; y: number } => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: React.PointerEvent): void => {
    if (!isLinkTool || event.target !== containerRef.current) return
    event.preventDefault()
    containerRef.current?.setPointerCapture(event.pointerId)
    const p = localPoint(event)
    start.current = p
    setDraft({ left: p.x, top: p.y, width: 0, height: 0 })
  }

  const onPointerMove = (event: React.PointerEvent): void => {
    if (!start.current) return
    const p = localPoint(event)
    const s = start.current
    setDraft({
      left: Math.min(s.x, p.x),
      top: Math.min(s.y, p.y),
      width: Math.abs(p.x - s.x),
      height: Math.abs(p.y - s.y)
    })
  }

  const cancelGesture = (): void => {
    start.current = null
    setDraft(null)
  }

  const onPointerUp = (event: React.PointerEvent): void => {
    containerRef.current?.releasePointerCapture(event.pointerId)
    const s = start.current
    start.current = null
    setDraft(null)
    if (!s || !isLinkTool) return
    const end = localPoint(event)
    // Ignore a click or near-zero drag (tiny in BOTH axes).
    if (Math.abs(end.x - s.x) < 6 && Math.abs(end.y - s.y) < 6) return
    const a = screenToPage(viewport, s.x, s.y)
    const b = screenToPage(viewport, end.x, end.y)
    const id = newLinkId()
    addLink(docId, pageKey, {
      id,
      url: '',
      rect: {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y)
      }
    })
    // Open the URL editor immediately so the user can type the address.
    cancelEdit.current = false
    setDraftUrl('')
    setEditingId(id)
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        zIndex: 5,
        pointerEvents: isLinkTool ? 'auto' : 'none',
        cursor: isLinkTool ? 'crosshair' : 'default'
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelGesture}
      onLostPointerCapture={cancelGesture}
    >
      {links.map((link) => {
        const r = pageRectToScreen(viewport, link.rect)
        const editing = editingId === link.id
        const valid = sanitizeUrl(link.url) !== null
        const beginEdit = (): void => {
          // Ignore a double-click that bubbles up from inside the open editor
          // (e.g. double-click-to-select-a-word) — it must not reset the draft.
          if (!isLinkTool || editing) return
          cancelEdit.current = false
          setDraftUrl(link.url)
          setEditingId(link.id)
        }
        const commitEdit = (): void => {
          if (cancelEdit.current) {
            cancelEdit.current = false
            return
          }
          setEditingId(null)
          const next = draftUrl.trim()
          // An empty URL is not a usable link — drop it (covers an abandoned
          // create, where the link was added before the URL was typed).
          if (next === '') removeLink(docId, pageKey, link.id)
          else if (next !== link.url) updateLinkUrl(docId, pageKey, link.id, next)
        }
        return (
          <div
            key={link.id}
            className={
              'group absolute rounded-sm border border-dashed ' +
              (valid ? 'border-sky-500 bg-sky-500/10' : 'border-amber-500 bg-amber-500/10')
            }
            style={{
              left: r.x,
              top: r.y,
              width: r.width,
              height: r.height,
              pointerEvents: isLinkTool ? 'auto' : 'none'
            }}
            onDoubleClick={beginEdit}
          >
            {editing ? (
              <div
                className="absolute left-0 top-0 flex w-64 -translate-y-full"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                    commitEdit()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    cancelEdit.current = true
                    setEditingId(null)
                    // Drop a link that was created but never given a URL.
                    if (link.url === '') removeLink(docId, pageKey, link.id)
                  } else if (event.key === 'Enter' && event.target instanceof HTMLElement) {
                    event.target.blur()
                  }
                }}
              >
                <input
                  autoFocus
                  aria-label="Link URL"
                  placeholder="https://example.com"
                  value={draftUrl}
                  onChange={(event) => setDraftUrl(event.target.value)}
                  className="w-full rounded-sm border border-sky-600 px-1 text-[11px] leading-tight outline-none"
                />
              </div>
            ) : (
              <span
                className={
                  'pointer-events-none absolute left-0 top-0 flex max-w-full -translate-y-full items-center gap-0.5 truncate rounded-t-sm px-1 text-[10px] leading-tight text-white ' +
                  (valid ? 'bg-sky-500' : 'bg-amber-600')
                }
                title={
                  isLinkTool
                    ? `${link.url || '(no URL)'} — double-click to edit`
                    : link.url || '(no URL)'
                }
              >
                <ExternalLink className="size-2.5 shrink-0" />
                {link.url || '(no URL)'}
              </span>
            )}
            {isLinkTool && !editing && (
              <button
                type="button"
                aria-label="Delete link"
                title="Delete link"
                onClick={() => removeLink(docId, pageKey, link.id)}
                className="absolute right-0 top-0 flex size-4 -translate-y-full items-center justify-center rounded-sm bg-sky-600 text-white opacity-0 group-hover:opacity-100 hover:bg-sky-700"
                style={{ pointerEvents: 'auto' }}
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )
      })}

      {draft && (draft.width > 0 || draft.height > 0) && (
        <div
          className="pointer-events-none absolute rounded-sm border border-sky-500 bg-sky-500/20"
          style={{ left: draft.left, top: draft.top, width: draft.width, height: draft.height }}
        />
      )}
    </div>
  )
}
