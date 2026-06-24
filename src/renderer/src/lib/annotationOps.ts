import { useDocumentStore } from '@/store/documentStore'
import { useHistoryStore } from '@/store/historyStore'
import type { Annotation } from '@/lib/annotations'

function pageAnnotations(docId: string, pageKey: string): Annotation[] {
  return useDocumentStore.getState().getTab(docId)?.annotations[pageKey] ?? []
}

/** Routes an annotation-list change for one page through the undo/redo engine. */
function commit(docId: string, pageKey: string, label: string, next: Annotation[]): void {
  const before = pageAnnotations(docId, pageKey)
  useHistoryStore.getState().execute(docId, {
    label,
    redo: () => useDocumentStore.getState().setPageAnnotations(docId, pageKey, next),
    undo: () => useDocumentStore.getState().setPageAnnotations(docId, pageKey, before)
  })
}

export function addAnnotation(docId: string, annotation: Annotation): void {
  commit(docId, annotation.pageKey, `Add ${annotation.type}`, [
    ...pageAnnotations(docId, annotation.pageKey),
    annotation
  ])
}

export function updateAnnotation(
  docId: string,
  annotation: Annotation,
  label = 'Edit annotation'
): void {
  const next = pageAnnotations(docId, annotation.pageKey).map((existing) =>
    existing.id === annotation.id ? annotation : existing
  )
  commit(docId, annotation.pageKey, label, next)
}

export function removeAnnotation(docId: string, pageKey: string, id: string): void {
  commit(
    docId,
    pageKey,
    'Delete annotation',
    pageAnnotations(docId, pageKey).filter((annotation) => annotation.id !== id)
  )
}
