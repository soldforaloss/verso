import type { Rect } from '@/lib/annotations'

/** The kinds of AcroForm field the editor can author. */
export type NewFieldType = 'text' | 'checkbox' | 'dropdown' | 'optionlist'

/**
 * A form field authored in the editor (vs. fields detected in the source PDF).
 * Stored per logical page key and created as a real AcroForm field on save.
 * `rect` is in PDF page space (bottom-left origin), as produced by `screenToPage`.
 */
export interface NewFormField {
  id: string
  type: NewFieldType
  /** Fully-qualified AcroForm field name (must be unique in its document). */
  name: string
  rect: Rect
  /** Selectable choices for `dropdown` / `optionlist` fields (ignored otherwise). */
  options?: string[]
}

const CHOICE_FIELD_TYPES = new Set<NewFieldType>(['dropdown', 'optionlist'])

/** True for field types that carry a list of selectable options. */
export function isChoiceField(type: NewFieldType): boolean {
  return CHOICE_FIELD_TYPES.has(type)
}

/** The options a freshly-authored choice field starts with. */
export function defaultFieldOptions(): string[] {
  return ['Option 1', 'Option 2', 'Option 3']
}

// The exact WinAnsi (CP1252) special block: code points outside Latin-1 that the
// StandardFont encoder can still represent (€, smart quotes, dashes, ™, …). This
// set plus 0x20–0x7E and 0xA0–0xFF reproduces pdf-lib's WinAnsiEncoding 1:1.
const WIN_ANSI_SPECIALS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178
])

function winAnsiEncodable(codePoint: number): boolean {
  return (
    (codePoint >= 0x20 && codePoint <= 0x7e) ||
    (codePoint >= 0xa0 && codePoint <= 0xff) ||
    WIN_ANSI_SPECIALS.has(codePoint)
  )
}

/**
 * Drops characters the StandardFont (Helvetica/WinAnsi) encoder can't represent
 * — CJK, Cyrillic, emoji, etc. This matters for choice-field option text: an
 * option list renders every option into its appearance stream, and a dropdown
 * renders its selected value, using Helvetica. A single un-encodable code point
 * makes pdf-lib throw during `PDFDocument.save()`'s global appearance pass —
 * which a per-field try/catch can't contain — aborting the WHOLE save with no
 * file written. Stripping at the boundary keeps the rest of the option usable.
 */
export function toWinAnsi(text: string): string {
  let out = ''
  for (const ch of text) {
    if (winAnsiEncodable(ch.codePointAt(0)!)) out += ch
  }
  return out
}

/**
 * Parses a user-entered option list (comma- or newline-separated) into trimmed,
 * non-empty, de-duplicated options. AcroForm choice fields reject duplicate
 * export values, so duplicates are collapsed (first occurrence wins). Characters
 * the PDF StandardFont can't encode are stripped (see `toWinAnsi`).
 */
export function parseFieldOptions(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[,\n]/)) {
    const option = toWinAnsi(raw.trim())
    if (option && !seen.has(option)) {
      seen.add(option)
      out.push(option)
    }
  }
  return out
}

export function newFieldId(): string {
  return crypto.randomUUID()
}

const NAME_PREFIX: Record<NewFieldType, string> = {
  text: 'Text',
  checkbox: 'Checkbox',
  dropdown: 'Dropdown',
  optionlist: 'List'
}

/**
 * A stable, unique field name. AcroForm names must be unique within a document
 * (pdf-lib throws otherwise), so we suffix with a short slice of a uuid.
 */
export function newFieldName(type: NewFieldType): string {
  return `${NAME_PREFIX[type]}_${crypto.randomUUID().slice(0, 8)}`
}
