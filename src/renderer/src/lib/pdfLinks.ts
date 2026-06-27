import { PDFHexString, type PDFPage } from 'pdf-lib'
import { sanitizeUrl, type PageLink } from '@/lib/links'

/**
 * Adds authored hyperlinks to a pdf-lib page as real, persistent `/Link`
 * annotations with a URI action — they stay clickable in the saved PDF (NOT
 * flattened). URLs are re-sanitized here (defense in depth) so a legacy or
 * recovered link can never write a dangerous URI; an invalid URL is skipped.
 */
export function addLinkAnnotations(page: PDFPage, links: PageLink[]): void {
  const ctx = page.doc.context
  for (const link of links) {
    const url = sanitizeUrl(link.url)
    if (!url) continue
    const x = link.rect.x
    const y = link.rect.y
    const annot = ctx.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, y, x + Math.max(1, link.rect.width), y + Math.max(1, link.rect.height)],
      // No visible border — the link is an invisible clickable hotspot.
      Border: [0, 0, 0],
      // Hex string (not a literal) so URL delimiter characters — '(', ')', '\' —
      // can't break the PDF object. URL.href is already ASCII (percent-encoded).
      A: { Type: 'Action', S: 'URI', URI: PDFHexString.fromText(url) }
    })
    page.node.addAnnot(ctx.register(annot))
  }
}
