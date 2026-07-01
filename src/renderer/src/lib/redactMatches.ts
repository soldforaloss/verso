import { newAnnotationId, type Annotation } from '@/lib/annotations'
import { addAnnotationsAcrossPages } from '@/lib/annotationOps'
import { redactionRectForItem } from '@/lib/redactionGeometry'
import { getSource, useDocumentStore, type DocumentTab } from '@/store/documentStore'
import type { SearchMatch } from '@/lib/search'

/**
 * Marks every search match for redaction: turns each match's text items into
 * opaque redaction annotations (one undoable command). This only *marks* — the
 * existing "Apply redactions (permanent)" flow rasterizes the pages so the text
 * beneath is destroyed. Returns the number of redaction boxes created.
 *
 * `matches` reference text items by index into the same `getTextContent().items`
 * array the search produced them from, so the geometry stays in lockstep.
 *
 * `expectedRevision` is the tab's `sourceRevision` when the matches were
 * computed. If the document changed since (an in-place edit / OCR bumped the
 * revision), the item indices no longer map to the same glyphs, so we refuse
 * outright rather than redact the wrong content — this returns -1 to signal
 * "stale, nothing done".
 */
export async function markMatchesForRedaction(
  tab: DocumentTab,
  matches: SearchMatch[],
  expectedRevision: number
): Promise<number> {
  if (matches.length === 0) return 0
  const liveRevision = useDocumentStore.getState().getTab(tab.id)?.sourceRevision ?? 0
  if (liveRevision !== expectedRevision) return -1

  const byLogicalPage = new Map<number, SearchMatch[]>()
  for (const match of matches) {
    const list = byLogicalPage.get(match.page) ?? []
    list.push(match)
    byLogicalPage.set(match.page, list)
  }

  const byPageKey: Record<string, Annotation[]> = {}
  let count = 0

  for (const [page, pageMatches] of byLogicalPage) {
    const ref = tab.pages[page - 1]
    if (!ref || ref.kind !== 'source') continue
    const source = getSource(ref.sourceId)
    if (!source) continue
    const pdfPage = await source.pdf.getPage(ref.sourceIndex + 1)
    const items = (await pdfPage.getTextContent()).items

    const annotations: Annotation[] = []
    for (const match of pageMatches) {
      for (const index of match.itemIndices) {
        const item = items[index]
        if (!item) continue
        const rect = redactionRectForItem(item)
        if (!rect) continue
        annotations.push({
          id: newAnnotationId(),
          pageKey: ref.key,
          type: 'redaction',
          color: '#000000',
          opacity: 1,
          rect
        })
        count += 1
      }
    }
    if (annotations.length > 0) {
      byPageKey[ref.key] = [...(byPageKey[ref.key] ?? []), ...annotations]
    }
  }

  addAnnotationsAcrossPages(tab.id, byPageKey, 'Redact matches')
  return count
}
