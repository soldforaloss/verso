import { PDFHexString, type PDFPage, type PDFRef } from 'pdf-lib'
import { sanitizeUrl, type PageLink } from '@/lib/links'

/**
 * Adds authored links to a pdf-lib page as real, persistent `/Link` annotations
 * — they stay clickable in the saved PDF (NOT flattened).
 *
 * An external link writes a `/URI` action; its URL is re-sanitized here (defense
 * in depth) and serialized as a hex string so delimiter characters can't break
 * the object. An internal link writes a `/GoTo` action to its 1-based target
 * page, resolved via `resolveTargetPage` (a document-global page number → its
 * placed output page; returns undefined when the target wasn't emitted, e.g. an
 * extract/split subset) — unresolved targets are skipped. Any link that can't
 * produce a valid action is skipped rather than written.
 */
export function addLinkAnnotations(
  page: PDFPage,
  links: PageLink[],
  resolveTargetPage: (pageNumber: number) => PDFPage | undefined
): void {
  const ctx = page.doc.context
  for (const link of links) {
    const x = link.rect.x
    const y = link.rect.y
    const rect = [x, y, x + Math.max(1, link.rect.width), y + Math.max(1, link.rect.height)]
    let ref: PDFRef
    if (link.page != null) {
      const target = resolveTargetPage(link.page)
      if (!target) continue
      // [pageRef /XYZ left top zoom] — top-left of the target's MediaBox.
      const box = target.getMediaBox()
      ref = ctx.register(
        ctx.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: rect,
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'GoTo', D: [target.ref, 'XYZ', box.x, box.y + box.height, null] }
        })
      )
    } else {
      const url = sanitizeUrl(link.url)
      if (!url) continue
      ref = ctx.register(
        ctx.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: rect,
          // No visible border — the link is an invisible clickable hotspot.
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'URI', URI: PDFHexString.fromText(url) }
        })
      )
    }
    page.node.addAnnot(ref)
  }
}
