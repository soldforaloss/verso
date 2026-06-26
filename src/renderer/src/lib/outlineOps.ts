import { useDocumentStore } from '@/store/documentStore'
import { useHistoryStore } from '@/store/historyStore'
import type { OutlineItem } from '@/lib/outline'

/**
 * Routes a bookmark-tree change through the undo/redo engine as one command.
 * The caller computes `after` from the pure transforms in `outline.ts`. `before`
 * is the genuine prior value — `null` before the first edit — so undoing the
 * first edit restores the original-pass-through state.
 */
export function commitOutline(
  docId: string,
  before: OutlineItem[] | null,
  after: OutlineItem[],
  label: string
): void {
  useHistoryStore.getState().execute(docId, {
    label,
    redo: () => useDocumentStore.getState().setOutline(docId, after),
    undo: () => useDocumentStore.getState().setOutline(docId, before)
  })
}
