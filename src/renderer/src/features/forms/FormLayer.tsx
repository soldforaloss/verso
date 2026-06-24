import { useEffect, useState } from 'react'
import { detectPageFields, type FormField } from '@/lib/forms'
import { useFormStore, type FormValue } from '@/store/formStore'
import { useToolStore } from '@/store/toolStore'
import { useDocumentStore } from '@/store/documentStore'
import type { PageViewport, PdfDocument } from '@/lib/pdf'

interface Props {
  docId: string
  sourceId: string
  pdf: PdfDocument
  pageIndex: number
  viewport: PageViewport
}

interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

function rectToScreen(viewport: PageViewport, rect: [number, number, number, number]): ScreenRect {
  const [ax, ay] = viewport.convertToViewportPoint(rect[0], rect[1])
  const [bx, by] = viewport.convertToViewportPoint(rect[2], rect[3])
  return {
    left: Math.min(ax, bx),
    top: Math.min(ay, by),
    width: Math.abs(ax - bx),
    height: Math.abs(ay - by)
  }
}

/** Renders interactive controls over a source page's form fields. */
export function FormLayer({
  docId,
  sourceId,
  pdf,
  pageIndex,
  viewport
}: Props): React.JSX.Element | null {
  const tool = useToolStore((s) => s.tool)
  const values = useFormStore((s) => s.values)
  const setValue = useFormStore((s) => s.setValue)
  const markHasFields = useFormStore((s) => s.markHasFields)
  const [fields, setFields] = useState<FormField[]>([])

  useEffect(() => {
    let cancelled = false
    void pdf
      .getPage(pageIndex + 1)
      .then((page) => detectPageFields(page))
      .then((detected) => {
        if (cancelled) return
        setFields(detected)
        if (detected.length > 0) markHasFields(docId)
      })
    return () => {
      cancelled = true
    }
  }, [pdf, pageIndex, docId, markHasFields])

  if (fields.length === 0) return null

  const valueKey = (name: string): string => `${sourceId} ${name}`
  const update = (name: string, value: FormValue): void => {
    setValue(sourceId, name, value)
    useDocumentStore.getState().markDirty(docId)
  }
  const pointerEvents = tool === 'select' ? 'auto' : 'none'

  return (
    <div
      className="absolute inset-0"
      style={{ width: viewport.width, height: viewport.height, zIndex: 4, pointerEvents: 'none' }}
    >
      {fields.map((field) => {
        const rect = rectToScreen(viewport, field.rect)
        const stored = values[valueKey(field.fieldName)]
        return (
          <div
            key={field.id}
            className="absolute"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              pointerEvents
            }}
          >
            {renderControl(field, stored, update)}
          </div>
        )
      })}
    </div>
  )
}

function renderControl(
  field: FormField,
  stored: FormValue | undefined,
  update: (name: string, value: FormValue) => void
): React.JSX.Element {
  const disabled = field.readOnly
  const inputClass =
    'size-full border border-primary/50 bg-primary/5 px-1 text-[13px] text-black outline-none focus-visible:border-primary'

  switch (field.type) {
    case 'text': {
      const value = typeof stored === 'string' ? stored : field.defaultValue
      const common = {
        disabled,
        value,
        'aria-label': field.fieldName,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          update(field.fieldName, e.target.value),
        className: inputClass
      }
      return field.multiline ? (
        <textarea {...common} />
      ) : (
        <input type="text" {...common} maxLength={field.maxLen} />
      )
    }
    case 'checkbox': {
      const checked =
        typeof stored === 'boolean' ? stored : field.defaultValue === field.exportValue
      return (
        <input
          type="checkbox"
          disabled={disabled}
          aria-label={field.fieldName}
          checked={checked}
          onChange={(e) => update(field.fieldName, e.target.checked)}
          className="size-full accent-primary"
        />
      )
    }
    case 'radio': {
      const selected = typeof stored === 'string' ? stored : field.defaultValue
      return (
        <input
          type="radio"
          disabled={disabled}
          aria-label={`${field.fieldName}=${field.exportValue}`}
          name={field.fieldName}
          value={field.exportValue}
          checked={selected === field.exportValue}
          onChange={() => update(field.fieldName, field.exportValue ?? '')}
          className="size-full accent-primary"
        />
      )
    }
    case 'dropdown': {
      const value = typeof stored === 'string' ? stored : field.defaultValue
      return (
        <select
          disabled={disabled}
          aria-label={field.fieldName}
          value={value}
          onChange={(e) => update(field.fieldName, e.target.value)}
          className={inputClass}
        >
          <option value="" />
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }
    case 'listbox': {
      const value = Array.isArray(stored) ? stored : field.defaultValue ? [field.defaultValue] : []
      return (
        <select
          multiple
          disabled={disabled}
          aria-label={field.fieldName}
          value={value}
          onChange={(e) =>
            update(
              field.fieldName,
              Array.from(e.target.selectedOptions).map((o) => o.value)
            )
          }
          className={inputClass}
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }
  }
}
