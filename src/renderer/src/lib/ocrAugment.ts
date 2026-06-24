import { PDFDocument, StandardFonts } from 'pdf-lib'
import type { OcrWord } from '@/lib/ocr'

/**
 * Returns new source bytes with an **invisible** (opacity 0) text layer drawn at
 * the OCR word positions. The text is real PDF text — selectable and searchable —
 * but does not alter the page's appearance. Reloading this source makes the OCR
 * text flow through the existing text-layer, search, and save machinery.
 */
export async function augmentSourceWithText(
  bytes: Uint8Array,
  wordsByPageIndex: Map<number, OcrWord[]>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()

  for (const [pageIndex, words] of wordsByPageIndex) {
    const page = pages[pageIndex]
    if (!page) continue
    for (const word of words) {
      try {
        page.drawText(word.text, { x: word.x, y: word.y, size: word.fontSize, font, opacity: 0 })
      } catch {
        // Characters outside the standard font's encoding — skip that word.
      }
    }
  }

  const saved = await doc.save()
  const out = new Uint8Array(saved.length)
  out.set(saved)
  return out
}
