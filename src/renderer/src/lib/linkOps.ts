import { useDocumentStore } from '@/store/documentStore'
import { useHistoryStore } from '@/store/historyStore'
import type { PageLink } from '@/lib/links'

function pageLinks(docId: string, pageKey: string): PageLink[] {
  return useDocumentStore.getState().getTab(docId)?.links[pageKey] ?? []
}

/** Routes a link-list change for one page through the undo/redo engine. */
function commit(docId: string, pageKey: string, label: string, next: PageLink[]): void {
  const before = pageLinks(docId, pageKey)
  useHistoryStore.getState().execute(docId, {
    label,
    redo: () => useDocumentStore.getState().setPageLinks(docId, pageKey, next),
    undo: () => useDocumentStore.getState().setPageLinks(docId, pageKey, before)
  })
}

export function addLink(docId: string, pageKey: string, link: PageLink): void {
  commit(docId, pageKey, 'Add link', [...pageLinks(docId, pageKey), link])
}

export function removeLink(docId: string, pageKey: string, id: string): void {
  commit(
    docId,
    pageKey,
    'Delete link',
    pageLinks(docId, pageKey).filter((link) => link.id !== id)
  )
}

/** Sets a link to be external (a URL) or internal (a 1-based page), as one undo step. */
export function setLinkTarget(
  docId: string,
  pageKey: string,
  id: string,
  target: { url: string } | { page: number }
): void {
  commit(
    docId,
    pageKey,
    'Edit link',
    pageLinks(docId, pageKey).map((link) => {
      if (link.id !== id) return link
      // Rebuild the link so `page` is present for internal links and absent for
      // URL links (exactOptionalPropertyTypes: never set `page: undefined`).
      return 'page' in target
        ? { id: link.id, rect: link.rect, url: '', page: target.page }
        : { id: link.id, rect: link.rect, url: target.url }
    })
  )
}
