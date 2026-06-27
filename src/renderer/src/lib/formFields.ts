import type { Rect } from '@/lib/annotations'

/** The kinds of AcroForm field the editor can author. */
export type NewFieldType = 'text' | 'checkbox' | 'dropdown' | 'optionlist' | 'radio'

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
  /**
   * Options for option-bearing fields. For `dropdown` / `optionlist` these are
   * the selectable values (rendered with Helvetica). For `radio` these are the
   * per-button export values (NOT rendered, so they keep full Unicode); the
   * buttons are laid out within `rect` (see `radioButtonRects`). Ignored for
   * `text` / `checkbox`.
   */
  options?: string[]
}

const OPTION_FIELD_TYPES = new Set<NewFieldType>(['dropdown', 'optionlist', 'radio'])

/** True for field types that carry a user-editable list of options. */
export function fieldHasOptions(type: NewFieldType): boolean {
  return OPTION_FIELD_TYPES.has(type)
}

/** The options a freshly-authored option-bearing field starts with. */
export function defaultFieldOptions(): string[] {
  return ['Option 1', 'Option 2', 'Option 3']
}

/**
 * Lays out a radio group's buttons as a left-aligned vertical column of squares
 * within `bounding` (PDF page space, bottom-left origin), first option on top.
 * One square per option; the count must be at least 1.
 */
export function radioButtonRects(bounding: Rect, count: number): Rect[] {
  const n = Math.max(1, count)
  const rowHeight = bounding.height / n
  // Fit each square inside its row band (rowHeight) and the box width, capped at
  // 18pt. The lower bound is 0 (not a fixed minimum) so a tiny/degenerate drag
  // yields near-zero in-box buttons rather than oversized ones that overflow the
  // bounding rect and overlap their neighbours.
  const side = Math.max(0, Math.min(rowHeight - 2, bounding.width, 18))
  const rects: Rect[] = []
  for (let i = 0; i < n; i += 1) {
    // Row i counted from the top (highest y) downward; square centered in its row.
    const rowBottom = bounding.y + bounding.height - (i + 1) * rowHeight
    rects.push({
      x: bounding.x,
      y: rowBottom + (rowHeight - side) / 2,
      width: side,
      height: side
    })
  }
  return rects
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
 * Trims, drops empty, and de-duplicates a list of option strings (first wins).
 * When `sanitizeWinAnsi` is true (dropdown / option list, whose option text is
 * rendered), un-encodable characters are stripped via `toWinAnsi`; radio export
 * values pass `false` because they aren't rendered and keep full Unicode.
 */
export function cleanFieldOptions(options: string[], sanitizeWinAnsi = true): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of options) {
    const option = sanitizeWinAnsi ? toWinAnsi(raw.trim()) : raw.trim()
    if (option && !seen.has(option)) {
      seen.add(option)
      out.push(option)
    }
  }
  return out
}

/**
 * Parses a user-entered option list (comma- or newline-separated) into clean
 * options (see `cleanFieldOptions`).
 */
export function parseFieldOptions(text: string, sanitizeWinAnsi = true): string[] {
  return cleanFieldOptions(text.split(/[,\n]/), sanitizeWinAnsi)
}

export function newFieldId(): string {
  return crypto.randomUUID()
}

const NAME_PREFIX: Record<NewFieldType, string> = {
  text: 'Text',
  checkbox: 'Checkbox',
  dropdown: 'Dropdown',
  optionlist: 'List',
  radio: 'Radio'
}

/**
 * A stable, unique field name. AcroForm names must be unique within a document
 * (pdf-lib throws otherwise), so we suffix with a short slice of a uuid.
 */
export function newFieldName(type: NewFieldType): string {
  return `${NAME_PREFIX[type]}_${crypto.randomUUID().slice(0, 8)}`
}
