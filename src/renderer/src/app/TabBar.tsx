import { FileText, Plus, X } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { openViaDialog } from '@/lib/open'
import { cn } from '@/lib/utils'

/** Multi-document tab strip. Hidden when nothing is open. */
export function TabBar(): React.JSX.Element | null {
  const tabs = useDocumentStore((s) => s.tabs)
  const activeId = useDocumentStore((s) => s.activeId)
  const setActive = useDocumentStore((s) => s.setActive)
  const closeDocument = useDocumentStore((s) => s.closeDocument)

  if (tabs.length === 0) return null

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto border-b bg-card px-2 pt-1">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeId}
          onClick={() => setActive(tab.id)}
          className={cn(
            'group flex max-w-56 cursor-default items-center gap-2 rounded-t-md border border-b-0 px-3 py-1.5 text-sm',
            tab.id === activeId
              ? 'bg-background'
              : 'border-transparent text-muted-foreground hover:bg-accent'
          )}
        >
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate" title={tab.name}>
            {tab.name}
          </span>
          {tab.status === 'error' && <span className="size-1.5 rounded-full bg-destructive" />}
          {tab.dirty && (
            <span className="size-1.5 rounded-full bg-primary" title="Unsaved changes" />
          )}
          <button
            type="button"
            aria-label={`Close ${tab.name}`}
            className="-mr-1 flex size-4 shrink-0 items-center justify-center rounded opacity-0 hover:bg-muted group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              if (!tab.dirty || window.confirm(`Discard unsaved changes to “${tab.name}”?`)) {
                closeDocument(tab.id)
              }
            }}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        title="Open another PDF"
        aria-label="Open another PDF"
        className="my-1 flex size-7 items-center justify-center rounded hover:bg-accent"
        onClick={() => void openViaDialog()}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
