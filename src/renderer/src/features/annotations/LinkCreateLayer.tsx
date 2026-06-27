import { useRef, useState } from 'react'
import { CornerDownRight, ExternalLink, X } from 'lucide-react'
import type { PageViewport } from '@/lib/pdf'
import { pageRectToScreen, screenToPage } from '@/lib/annotationGeometry'
import { useToolStore } from '@/store/toolStore'
import { addLink, removeLink, setLinkTarget } from '@/lib/linkOps'
import { newLinkId, sanitizeUrl, type PageLink } from '@/lib/links'

interface DraftRect {
  left: number
  top: number
  width: number
  height: number
}

type LinkKind = 'url' | 'page'

/**
 * Overlay for authoring clickable links: when the link tool is active, drag a
 * rectangle to create a hotspot, then make it either a web URL or a jump to
 * another page. Existing links render as labelled previews (invalid targets
 * flagged amber) and can be deleted. The real `/Link` annotation is written on
 * save. When the link tool is inactive the overlay is entirely pass-through so
 * other tools reach the layers beneath.
 */
export function LinkCreateLayer({
  viewport,
  docId,
  pageKey,
  links,
  pageCount
}: {
  viewport: PageViewport
  docId: string
  pageKey: string
  links: PageLink[]
  pageCount: number
}): React.JSX.Element {
  const tool = useToolStore((s) => s.tool)
  const isLinkTool = tool === 'link'
  const containerRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState<DraftRect | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftKind, setDraftKind] = useState<LinkKind>('url')
  const [draftUrl, setDraftUrl] = useState('')
  const [draftPage, setDraftPage] = useState('')
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
    // Open the editor immediately so the user can set the target.
    cancelEdit.current = false
    setDraftKind('url')
    setDraftUrl('')
    setDraftPage('')
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
        const internal = link.page != null
        const valid = internal
          ? link.page! >= 1 && link.page! <= pageCount
          : sanitizeUrl(link.url) !== null
        const label = internal ? `Page ${link.page}` : link.url || '(no URL)'
        const empty = link.url === '' && link.page == null
        const beginEdit = (): void => {
          // Ignore a double-click bubbling up from inside the open editor.
          if (!isLinkTool || editing) return
          cancelEdit.current = false
          setDraftKind(internal ? 'page' : 'url')
          setDraftUrl(link.url)
          setDraftPage(link.page != null ? String(link.page) : '')
          setEditingId(link.id)
        }
        const commitEdit = (): void => {
          if (cancelEdit.current) {
            cancelEdit.current = false
            return
          }
          setEditingId(null)
          if (draftKind === 'page') {
            const n = parseInt(draftPage, 10)
            if (Number.isInteger(n) && n >= 1) {
              if (link.page !== n) setLinkTarget(docId, pageKey, link.id, { page: n })
            } else if (empty) {
              removeLink(docId, pageKey, link.id) // abandoned, never targeted
            }
          } else {
            const next = draftUrl.trim()
            if (next !== '') {
              if (link.url !== next || internal) {
                setLinkTarget(docId, pageKey, link.id, { url: next })
              }
            } else if (link.page == null) {
              removeLink(docId, pageKey, link.id) // abandoned URL link
            }
          }
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
                className="absolute left-0 top-0 flex w-64 -translate-y-full flex-col gap-px"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                    commitEdit()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    cancelEdit.current = true
                    setEditingId(null)
                    if (empty) removeLink(docId, pageKey, link.id)
                  } else if (event.key === 'Enter' && event.target instanceof HTMLElement) {
                    event.target.blur()
                  }
                }}
              >
                <div className="flex items-center overflow-hidden rounded-t-sm border border-sky-600">
                  {(['url', 'page'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={draftKind === kind}
                      onClick={() => setDraftKind(kind)}
                      className={
                        'flex-1 px-1 py-0.5 text-[10px] capitalize leading-tight ' +
                        (draftKind === kind ? 'bg-sky-500 text-white' : 'bg-white text-sky-900')
                      }
                    >
                      {kind === 'url' ? 'Web' : 'Page'}
                    </button>
                  ))}
                </div>
                {draftKind === 'url' ? (
                  <input
                    // Distinct key so toggling remounts the input and autoFocus re-fires.
                    key="url"
                    autoFocus
                    aria-label="Link URL"
                    placeholder="https://example.com"
                    value={draftUrl}
                    onChange={(event) => setDraftUrl(event.target.value)}
                    className="rounded-b-sm border border-sky-600 px-1 text-[11px] leading-tight outline-none"
                  />
                ) : (
                  <input
                    key="page"
                    autoFocus
                    type="number"
                    min={1}
                    max={pageCount}
                    aria-label="Target page"
                    placeholder={`Page (1-${pageCount})`}
                    value={draftPage}
                    onChange={(event) => setDraftPage(event.target.value)}
                    className="rounded-b-sm border border-sky-600 px-1 text-[11px] leading-tight outline-none"
                  />
                )}
              </div>
            ) : (
              <span
                className={
                  'pointer-events-none absolute left-0 top-0 flex max-w-full -translate-y-full items-center gap-0.5 truncate rounded-t-sm px-1 text-[10px] leading-tight text-white ' +
                  (valid ? 'bg-sky-500' : 'bg-amber-600')
                }
                title={isLinkTool ? `${label} — double-click to edit` : label}
              >
                {internal ? (
                  <CornerDownRight className="size-2.5 shrink-0" />
                ) : (
                  <ExternalLink className="size-2.5 shrink-0" />
                )}
                {label}
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
