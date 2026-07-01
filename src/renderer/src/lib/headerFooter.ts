/**
 * Header/footer token expansion — a pure, DOM-free helper (unit-testable in
 * node). The date is passed in pre-formatted so expansion stays deterministic.
 */

/** The six positioned slots of a header/footer, matching Adobe's layout grid. */
export type HeaderFooterSlot =
  | 'headerLeft'
  | 'headerCenter'
  | 'headerRight'
  | 'footerLeft'
  | 'footerCenter'
  | 'footerRight'

export const HEADER_FOOTER_SLOTS: {
  slot: HeaderFooterSlot
  band: 'header' | 'footer'
  align: 'left' | 'center' | 'right'
}[] = [
  { slot: 'headerLeft', band: 'header', align: 'left' },
  { slot: 'headerCenter', band: 'header', align: 'center' },
  { slot: 'headerRight', band: 'header', align: 'right' },
  { slot: 'footerLeft', band: 'footer', align: 'left' },
  { slot: 'footerCenter', band: 'footer', align: 'center' },
  { slot: 'footerRight', band: 'footer', align: 'right' }
]

/** The substitution values for a single page. */
export interface HeaderFooterContext {
  /** 1-based page number. */
  page: number
  /** Total page count. */
  pages: number
  /** Pre-formatted date string. */
  date: string
  /** Document file name. */
  filename: string
}

/**
 * Replaces `{page}`, `{pages}`, `{date}`, and `{filename}` in a template. Tokens
 * are substituted in a fixed order and the injected values are never re-scanned,
 * so a filename that itself contains a brace token stays literal.
 */
export function expandHeaderFooter(template: string, ctx: HeaderFooterContext): string {
  return template
    .replace(/\{page\}/g, String(ctx.page))
    .replace(/\{pages\}/g, String(ctx.pages))
    .replace(/\{date\}/g, ctx.date)
    .replace(/\{filename\}/g, ctx.filename)
}
