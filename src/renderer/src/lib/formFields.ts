import type { Rect } from '@/lib/annotations'

/**
 * A form field authored in the editor (vs. fields detected in the source PDF).
 * Stored per logical page key and created as a real AcroForm field on save.
 * `rect` is in PDF page space (bottom-left origin), as produced by `screenToPage`.
 */
export interface NewFormField {
  id: string
  type: 'text' | 'checkbox'
  /** Fully-qualified AcroForm field name (must be unique in its document). */
  name: string
  rect: Rect
}

export function newFieldId(): string {
  return crypto.randomUUID()
}

/**
 * A stable, unique field name. AcroForm names must be unique within a document
 * (pdf-lib throws otherwise), so we suffix with a short slice of a uuid.
 */
export function newFieldName(type: NewFormField['type']): string {
  const prefix = type === 'checkbox' ? 'Checkbox' : 'Text'
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}
