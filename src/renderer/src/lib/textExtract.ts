import type { TextContentItem } from '@/lib/pdf'

/**
 * Reconstructs a page's plain text from pdf.js text-content items in reading
 * order. Each item's string is appended; a newline is inserted where pdf.js
 * marks an end-of-line (`hasEOL`), which reproduces the document's line breaks.
 * Marked-content items (no `str`) are skipped.
 *
 * Pure and DOM-free (types only) so it is unit-testable without pdf.js.
 */
export function itemsToText(items: readonly TextContentItem[]): string {
  let out = ''
  for (const item of items) {
    if (!('str' in item)) continue
    out += item.str
    if (item.hasEOL) out += '\n'
  }
  // Trim trailing whitespace per line, then collapse 3+ blank lines to 2.
  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Joins per-page texts into one document, separated by a blank line. */
export function joinPageTexts(pages: string[]): string {
  return pages.filter((page) => page.length > 0).join('\n\n')
}

/** Output file name for a text export (`<doc>.txt`). */
export function textFileName(docName: string): string {
  return `${docName.replace(/\.pdf$/i, '')}.txt`
}
