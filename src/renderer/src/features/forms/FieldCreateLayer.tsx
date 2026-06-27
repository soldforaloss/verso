import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { PageViewport } from '@/lib/pdf'
import { pageRectToScreen, screenToPage } from '@/lib/annotationGeometry'
import { FIELD_TOOLS, useToolStore, type Tool } from '@/store/toolStore'
import { addFormField, removeFormField, updateFormField } from '@/lib/formFieldOps'
import {
  defaultFieldOptions,
  isChoiceField,
  newFieldId,
  newFieldName,
  parseFieldOptions,
  type NewFieldType,
  type NewFormField
} from '@/lib/formFields'

interface DraftRect {
  left: number
  top: number
  width: number
  height: number
}

/** Maps the active field tool to the field type it authors. */
const FIELD_TYPE_BY_TOOL: Partial<Record<Tool, NewFieldType>> = {
  'field-text': 'text',
  'field-checkbox': 'checkbox',
  'field-dropdown': 'dropdown',
  'field-optionlist': 'optionlist'
}

/** A glyph shown on each field preview so the type reads at a glance. */
const FIELD_GLYPH: Record<NewFieldType, string> = {
  text: '▭',
  checkbox: '☑',
  dropdown: '▼',
  optionlist: '☰'
}

/**
 * Overlay for authoring AcroForm fields: when a field tool is active, drag to
 * place a text field, checkbox, dropdown, or option list. Choice fields seed a
 * default option list that can be edited inline. Existing authored fields render
 * as labelled previews and can be deleted while a field tool is active. The real
 * field is created in the PDF on save. When no field tool is active the overlay
 * is entirely pass-through (no interactive descendants), so select/markup tools
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftOptions, setDraftOptions] = useState('')
  // Set when Escape cancels an edit so the resulting blur doesn't commit it.
  const cancelEdit = useRef(false)

  const localPoint = (event: React.PointerEvent): { x: number; y: number } => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: React.PointerEvent): void => {
    // Only start a create-drag on empty space; clicks on an existing field
    // preview are handled by that preview (rename / delete).
    if (!isFieldTool || event.target !== containerRef.current) return
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
    const type = FIELD_TYPE_BY_TOOL[tool] ?? 'text'
    const field: NewFormField = {
      id: newFieldId(),
      type,
      name: newFieldName(type),
      rect: {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y)
      },
      // Choice fields need at least one option to be usable; seed a default set.
      ...(isChoiceField(type) ? { options: defaultFieldOptions() } : {})
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
        const editing = editingId === field.id
        const choice = isChoiceField(field.type)
        const beginEdit = (): void => {
          if (!isFieldTool) return
          cancelEdit.current = false
          setDraftName(field.name)
          setDraftOptions((field.options ?? []).join(', '))
          setEditingId(field.id)
        }
        const commitEdit = (): void => {
          if (cancelEdit.current) {
            cancelEdit.current = false
            return
          }
          setEditingId(null)
          const patch: { name?: string; options?: string[] } = {}
          const nextName = draftName.trim()
          if (nextName && nextName !== field.name) patch.name = nextName
          if (choice) {
            const next = parseFieldOptions(draftOptions)
            const prev = field.options ?? []
            const changed = next.length !== prev.length || next.some((o, i) => o !== prev[i])
            if (next.length && changed) patch.options = next
          }
          if (patch.name !== undefined || patch.options !== undefined) {
            updateFormField(docId, pageKey, field.id, patch)
          }
        }
        return (
          <div
            key={field.id}
            // Interactive only while a field tool is active (double-click to
            // edit, × to delete); in select mode it is pass-through so the
            // form/annotation layers beneath stay reachable.
            className="group absolute rounded-sm border border-dashed border-sky-500 bg-sky-500/10"
            style={{
              left: r.x,
              top: r.y,
              width: r.width,
              height: r.height,
              pointerEvents: isFieldTool ? 'auto' : 'none'
            }}
            onDoubleClick={beginEdit}
          >
            {editing ? (
              <div
                className="absolute left-0 top-0 flex w-56 -translate-y-full flex-col gap-px"
                // Commit once focus leaves the whole editor (moving between the
                // name and options inputs keeps focus inside, so no commit).
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                    commitEdit()
                }}
              >
                <input
                  autoFocus
                  aria-label="Field name"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                    else if (event.key === 'Escape') {
                      cancelEdit.current = true
                      setEditingId(null)
                    }
                  }}
                  className="rounded-t-sm border border-sky-600 px-1 text-[11px] leading-tight outline-none"
                />
                {choice && (
                  <input
                    aria-label="Field options"
                    placeholder="Comma-separated options"
                    value={draftOptions}
                    onChange={(event) => setDraftOptions(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                      else if (event.key === 'Escape') {
                        cancelEdit.current = true
                        setEditingId(null)
                      }
                    }}
                    className="rounded-b-sm border border-sky-600 px-1 text-[11px] leading-tight outline-none"
                  />
                )}
              </div>
            ) : (
              <span
                className="pointer-events-none absolute left-0 top-0 max-w-full -translate-y-full truncate rounded-t-sm bg-sky-500 px-1 text-[10px] leading-tight text-white"
                title={isFieldTool ? `${field.name} — double-click to edit` : field.name}
              >
                {FIELD_GLYPH[field.type]} {field.name}
                {choice ? ` (${field.options?.length ?? 0})` : ''}
              </span>
            )}
            {isFieldTool && !editing && (
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
