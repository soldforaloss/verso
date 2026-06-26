import { useDocumentStore } from '@/store/documentStore'
import { useHistoryStore } from '@/store/historyStore'
import { newAnnotationId, reorderAnnotations, type Annotation } from '@/lib/annotations'

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

/** Adds several annotations to one page as a single undoable command. */
export function addAnnotations(docId: string, annotations: Annotation[], label = 'Edit'): void {
  if (annotations.length === 0) return
  const pageKey = annotations[0]!.pageKey
  commit(docId, pageKey, label, [...pageAnnotations(docId, pageKey), ...annotations])
}

/**
 * Adds annotations to many pages at once as a single undoable command (used by
 * batch inserts like watermarks and page numbers).
 */
export function addAnnotationsAcrossPages(
  docId: string,
  byPageKey: Record<string, Annotation[]>,
  label: string
): void {
  const tab = useDocumentStore.getState().getTab(docId)
  if (!tab) return
  const keys = Object.keys(byPageKey).filter((key) => (byPageKey[key] ?? []).length > 0)
  if (keys.length === 0) return

  const before: Record<string, Annotation[]> = {}
  const after: Record<string, Annotation[]> = {}
  for (const key of keys) {
    before[key] = tab.annotations[key] ?? []
    after[key] = [...before[key]!, ...byPageKey[key]!]
  }
  const apply = (state: Record<string, Annotation[]>): void => {
    const store = useDocumentStore.getState()
    for (const key of keys) store.setPageAnnotations(docId, key, state[key]!)
  }
  useHistoryStore.getState().execute(docId, {
    label,
    redo: () => apply(after),
    undo: () => apply(before)
  })
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

/** Places an image annotation (Tier 1) near the top of the given page. */
export function addImageAnnotation(
  docId: string,
  pageKey: string,
  dataUrl: string,
  aspect: number
): string {
  const width = 220
  const height = Math.round(width / (aspect > 0 ? aspect : 1))
  const annotation: Annotation = {
    id: newAnnotationId(),
    pageKey,
    type: 'image',
    color: '#000000',
    opacity: 1,
    dataUrl,
    rect: { x: 72, y: 540, width, height }
  }
  addAnnotation(docId, annotation)
  return annotation.id
}

/** Moves an annotation to the front or back of its page's draw order (undoable). */
export function reorderAnnotation(
  docId: string,
  pageKey: string,
  id: string,
  to: 'front' | 'back'
): void {
  const current = pageAnnotations(docId, pageKey)
  const next = reorderAnnotations(current, id, to)
  if (next === current) return
  commit(docId, pageKey, to === 'front' ? 'Bring to front' : 'Send to back', next)
}

export function removeAnnotation(docId: string, pageKey: string, id: string): void {
  commit(
    docId,
    pageKey,
    'Delete annotation',
    pageAnnotations(docId, pageKey).filter((annotation) => annotation.id !== id)
  )
}
