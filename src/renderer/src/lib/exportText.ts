import { loadPdfDocument } from '@/lib/pdf'
import { buildDocumentPdf } from '@/lib/save'
import { itemsToText, joinPageTexts, textFileName } from '@/lib/textExtract'
import type { DocumentTab } from '@/store/documentStore'

/**
 * Extracts the selected pages' text (in reading order) and writes it to a chosen
 * `.txt` file. Text is read from the materialized (built) document, so flattened
 * annotations and filled fields are included — the export matches what the viewer
 * shows.
 *
 * The caller must guard against unapplied redaction marks first: extracting text
 * from a document whose "redacted" regions are only covered (not rasterized)
 * would export the still-recoverable text.
 *
 * Returns 1 if a file was written, 0 if the user cancelled or nothing matched.
 */
export async function exportPagesToText(tab: DocumentTab, pages: number[]): Promise<number> {
  const pageNumbers = pages.filter((n) => n >= 1 && n <= tab.pages.length)
  if (pageNumbers.length === 0) return 0

  const bytes = await buildDocumentPdf(tab)
  const { pdf, destroy } = await loadPdfDocument(bytes)
  let text: string
  try {
    const parts: string[] = []
    for (const pageNumber of pageNumbers) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      parts.push(itemsToText(content.items))
    }
    text = joinPageTexts(parts)
  } finally {
    await destroy()
  }

  const path = await window.api.showSaveDialog({
    defaultName: textFileName(tab.name),
    fileType: 'text'
  })
  if (!path) return 0
  await window.api.writeFile({ path, bytes: new TextEncoder().encode(text) })
  return 1
}
