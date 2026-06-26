import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { PageViewport } from '@/lib/pdf'
import { pageRectToScreen, screenToPage } from '@/lib/annotationGeometry'
import { FIELD_TOOLS, useToolStore } from '@/store/toolStore'
import { addFormField, removeFormField } from '@/lib/formFieldOps'
import { newFieldId, newFieldName, type NewFormField } from '@/lib/formFields'

interface DraftRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Overlay for authoring AcroForm fields: when a field tool is active, drag to
 * place a text field or checkbox. Existing authored fields render as labelled
 * previews and can be deleted while a field tool is active. The real field is
 * created in the PDF on save. When no field tool is active the overlay is
 * entirely pass-through (no interactive descendants), so select/markup tools
 * reach the form and annotation layers beneath it.
 */
export function FieldCreateLayer({
  viewport,
  docId,
  pageKey,
  fields
}: {
  viewport: PageViewport
  docId: string
  pageKey: string
  fields: NewFormField[]
}): React.JSX.Element {
  const tool = useToolStore((s) => s.tool)
  const isFieldTool = FIELD_TOOLS.has(tool)
  const containerRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState<DraftRect | null>(null)

  const localPoint = (event: React.PointerEvent): { x: number; y: number } => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: React.PointerEvent): void => {
    if (!isFieldTool) return
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
    if (!s || !isFieldTool) return
    const end = localPoint(event)
    // Ignore a click or a near-zero drag (tiny in BOTH axes); a thin/wide field
    // (small in one axis only) is valid.
    if (Math.abs(end.x - s.x) < 6 && Math.abs(end.y - s.y) < 6) return
    const a = screenToPage(viewport, s.x, s.y)
    const b = screenToPage(viewport, end.x, end.y)
    const type = tool === 'field-checkbox' ? 'checkbox' : 'text'
    const field: NewFormField = {
      id: newFieldId(),
      type,
      name: newFieldName(type),
      rect: {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y)
      }
    }
    addFormField(docId, pageKey, field)
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        zIndex: 5,
        pointerEvents: isFieldTool ? 'auto' : 'none',
        cursor: isFieldTool ? 'crosshair' : 'default'
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelGesture}
      onLostPointerCapture={cancelGesture}
    >
      {fields.map((field) => {
        const r = pageRectToScreen(viewport, field.rect)
        return (
          <div
            key={field.id}
            className="group absolute rounded-sm border border-dashed border-sky-500 bg-sky-500/10"
            style={{ left: r.x, top: r.y, width: r.width, height: r.height, pointerEvents: 'none' }}
          >
            <span className="pointer-events-none absolute left-0 top-0 -translate-y-full rounded-t-sm bg-sky-500 px-1 text-[10px] leading-tight text-white">
              {field.type === 'checkbox' ? '☑ Checkbox' : '▭ Text field'}
            </span>
            {/* Only interactive while a field tool is active, so the z5 overlay
                exposes no hit targets that would block the layers beneath it. */}
            {isFieldTool && (
              <button
                type="button"
                aria-label="Delete field"
                title="Delete field"
                onClick={() => removeFormField(docId, pageKey, field.id)}
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
