import type { PdfPage } from '@/lib/pdf'

export type FieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'listbox'

export interface FormFieldOption {
  value: string
  label: string
}

/** A form widget on a page, normalized from a PDF.js annotation. */
export interface FormField {
  /** Unique per widget (PDF.js annotation id). */
  id: string
  fieldName: string
  type: FieldType
  /** PDF-space rect [x1, y1, x2, y2]. */
  rect: [number, number, number, number]
  readOnly: boolean
  multiline: boolean
  maxLen?: number
  /** Checkbox/radio "on" value. */
  exportValue?: string
  options: FormFieldOption[]
  /** The field's current value from the document. */
  defaultValue: string
}

interface RawWidget {
  id: string
  subtype?: string
  fieldType?: string
  fieldName?: string
  fieldValue?: unknown
  rect: [number, number, number, number]
  readOnly?: boolean
  multiLine?: boolean
  maxLen?: number
  checkBox?: boolean
  radioButton?: boolean
  pushButton?: boolean
  combo?: boolean
  exportValue?: string
  buttonValue?: string
  options?: { exportValue?: string; displayValue?: string }[]
}

/** Detects fillable form widgets on a source page. */
export async function detectPageFields(page: PdfPage): Promise<FormField[]> {
  const annotations = (await page.getAnnotations({ intent: 'display' })) as unknown as RawWidget[]
  const fields: FormField[] = []

  for (const widget of annotations) {
    if (widget.subtype !== 'Widget' || !widget.fieldName) continue
    const base = {
      id: widget.id,
      fieldName: widget.fieldName,
      rect: widget.rect,
      readOnly: Boolean(widget.readOnly),
      multiline: Boolean(widget.multiLine),
      options: [] as FormFieldOption[],
      defaultValue: typeof widget.fieldValue === 'string' ? widget.fieldValue : ''
    }

    if (widget.fieldType === 'Tx') {
      fields.push({ ...base, type: 'text', ...(widget.maxLen ? { maxLen: widget.maxLen } : {}) })
    } else if (widget.fieldType === 'Btn') {
      if (widget.pushButton) continue
      const exportValue = widget.exportValue ?? widget.buttonValue ?? 'On'
      fields.push({ ...base, type: widget.radioButton ? 'radio' : 'checkbox', exportValue })
    } else if (widget.fieldType === 'Ch') {
      const options = (widget.options ?? []).map((o) => ({
        value: o.exportValue ?? '',
        label: o.displayValue ?? o.exportValue ?? ''
      }))
      fields.push({ ...base, type: widget.combo ? 'dropdown' : 'listbox', options })
    }
  }

  return fields
}
