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

export function updateLinkUrl(docId: string, pageKey: string, id: string, url: string): void {
  commit(
    docId,
    pageKey,
    'Edit link',
    pageLinks(docId, pageKey).map((link) => (link.id === id ? { ...link, url } : link))
  )
}
