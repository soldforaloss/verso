import { Trash2 } from 'lucide-react'
import { useViewStore } from '@/store/viewStore'
import { useToolStore } from '@/store/toolStore'
import { removeAnnotation, updateAnnotation } from '@/lib/annotationOps'
import type { Annotation } from '@/lib/annotations'
import type { DocumentTab } from '@/store/documentStore'

type Commentable = Extract<Annotation, { type: 'note' | 'text' }>

/** Lists every sticky note and text annotation; click to jump + select, edit inline. */
export function CommentsPanel({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const requestScrollToPage = useViewStore((s) => s.requestScrollToPage)
  const selectAnnotation = useToolStore((s) => s.selectAnnotation)
  const setTool = useToolStore((s) => s.setTool)

  const pageNumberOf = (pageKey: string): number | null => {
    const index = tab.pages.findIndex((page) => page.key === pageKey)
    return index >= 0 ? index + 1 : null
  }

  const items: { annotation: Commentable; pageKey: string; page: number | null }[] = []
  for (const [pageKey, annotations] of Object.entries(tab.annotations)) {
    for (const annotation of annotations) {
      if (annotation.type === 'note' || annotation.type === 'text') {
        items.push({ annotation, pageKey, page: pageNumberOf(pageKey) })
      }
    }
  }
  items.sort((a, b) => (a.page ?? 0) - (b.page ?? 0))

  if (items.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No comments yet. Use the sticky-note or text tool to add one.
      </div>
    )
  }

  return (
    <div className="space-y-2 overflow-auto p-2">
      {items.map(({ annotation, pageKey, page }) => (
        <div key={annotation.id} className="rounded-md border p-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => {
                setTool('select')
                if (page) requestScrollToPage(page)
                selectAnnotation(pageKey, annotation.id)
              }}
            >
              Page {page ?? '—'} · {annotation.type === 'note' ? 'Note' : 'Text'}
            </button>
            <button
              type="button"
              title="Delete"
              className="flex size-5 items-center justify-center rounded hover:bg-muted"
              onClick={() => removeAnnotation(tab.id, pageKey, annotation.id)}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <textarea
            key={`${annotation.id}:${annotation.text}`}
            defaultValue={annotation.text}
            rows={2}
            placeholder={annotation.type === 'note' ? 'Comment…' : 'Text…'}
            onBlur={(event) => {
              if (event.target.value !== annotation.text) {
                updateAnnotation(
                  tab.id,
                  { ...annotation, text: event.target.value },
                  'Edit comment'
                )
              }
            }}
            className="mt-1 w-full resize-none rounded border bg-background p-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      ))}
    </div>
  )
}
