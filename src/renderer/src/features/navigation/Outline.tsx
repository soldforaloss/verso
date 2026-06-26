import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Trash2
} from 'lucide-react'
import { getSource, useDocumentStore, type DocumentTab } from '@/store/documentStore'
import { useViewStore } from '@/store/viewStore'
import type { PageRef } from '@/lib/pageModel'
import type { PdfDocument } from '@/lib/pdf'
import { cn } from '@/lib/utils'
import {
  appendItem,
  deleteItem,
  indentItem,
  makeOutlineItem,
  moveItem,
  newOutlineId,
  outdentItem,
  renameItem,
  type OutlineItem
} from '@/lib/outline'
import { commitOutline } from '@/lib/outlineOps'

type OutlineNode = NonNullable<Awaited<ReturnType<PdfDocument['getOutline']>>>[number]
type Destination = OutlineNode['dest']

/** Resolves an outline destination to a 0-based page index in the source. */
async function destinationToSourceIndex(
  pdf: PdfDocument,
  dest: Destination
): Promise<number | null> {
  if (!dest) return null
  const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest
  if (!Array.isArray(explicit) || explicit.length === 0) return null
  try {
    return await pdf.getPageIndex(explicit[0] as Parameters<PdfDocument['getPageIndex']>[0])
  } catch {
    return null
  }
}

/** Builds the editable tree from the PDF's outline, anchoring items to page keys. */
async function buildInitialOutline(
  pdf: PdfDocument,
  primarySourceId: string,
  pages: PageRef[]
): Promise<OutlineItem[]> {
  const nodes = (await pdf.getOutline()) as OutlineNode[] | null
  if (!nodes) return []
  const keyForSourceIndex = (sourceIndex: number): string | null =>
    pages.find(
      (page) =>
        page.kind === 'source' &&
        page.sourceId === primarySourceId &&
        page.sourceIndex === sourceIndex
    )?.key ?? null

  const convert = async (node: OutlineNode): Promise<OutlineItem> => {
    const sourceIndex = await destinationToSourceIndex(pdf, node.dest)
    const children: OutlineItem[] = []
    for (const child of node.items) children.push(await convert(child))
    return {
      id: newOutlineId(),
      title: node.title || 'Untitled',
      pageKey: sourceIndex === null ? null : keyForSourceIndex(sourceIndex),
      children,
      expanded: true
    }
  }

  const items: OutlineItem[] = []
  for (const node of nodes) items.push(await convert(node))
  return items
}

interface RowCallbacks {
  navigate: (pageKey: string | null) => void
  /** True if the item's destination page still exists in the document. */
  resolves: (pageKey: string | null) => boolean
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  move: (id: string, direction: -1 | 1) => void
  indent: (id: string) => void
  outdent: (id: string) => void
}

function OutlineRow({
  item,
  depth,
  collapsed,
  toggleCollapsed,
  cb
}: {
  item: OutlineItem
  depth: number
  collapsed: Set<string>
  toggleCollapsed: (id: string) => void
  cb: RowCallbacks
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.title)
  const hasChildren = item.children.length > 0
  const isOpen = !collapsed.has(item.id)
  const broken = item.pageKey !== null && !cb.resolves(item.pageKey)

  const commitRename = (): void => {
    setEditing(false)
    const next = draft.trim()
    if (next && next !== item.title) cb.rename(item.id, next)
    else setDraft(item.title)
  }

  return (
    <li>
      <div className="group flex items-center gap-0.5 pr-1" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
            className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
            onClick={() => toggleCollapsed(item.id)}
          >
            <ChevronRight className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')} />
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        {editing ? (
          <input
            autoFocus
            value={draft}
            aria-label="Bookmark title"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              else if (event.key === 'Escape') {
                setDraft(item.title)
                setEditing(false)
              }
            }}
            className="h-6 flex-1 rounded border bg-background px-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        ) : (
          <button
            type="button"
            className={cn(
              'flex-1 truncate rounded px-1 py-1 text-left text-sm hover:bg-accent',
              broken && 'italic text-muted-foreground'
            )}
            title={broken ? `${item.title} — page no longer in the document` : item.title}
            onClick={() => cb.navigate(item.pageKey)}
            onDoubleClick={() => {
              setDraft(item.title)
              setEditing(true)
            }}
          >
            {item.title}
          </button>
        )}

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          <RowButton label="Move up" onClick={() => cb.move(item.id, -1)}>
            <ChevronUp className="size-3.5" />
          </RowButton>
          <RowButton label="Move down" onClick={() => cb.move(item.id, 1)}>
            <ChevronDown className="size-3.5" />
          </RowButton>
          <RowButton label="Unnest" onClick={() => cb.outdent(item.id)}>
            <IndentDecrease className="size-3.5" />
          </RowButton>
          <RowButton label="Nest" onClick={() => cb.indent(item.id)}>
            <IndentIncrease className="size-3.5" />
          </RowButton>
          <RowButton label="Delete bookmark" onClick={() => cb.remove(item.id)}>
            <Trash2 className="size-3.5" />
          </RowButton>
        </div>
      </div>

      {isOpen && hasChildren && (
        <ul>
          {item.children.map((child) => (
            <OutlineRow
              key={child.id}
              item={child}
              depth={depth + 1}
              collapsed={collapsed}
              toggleCollapsed={toggleCollapsed}
              cb={cb}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function RowButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  )
}

/** Editable document outline (bookmarks) for the tab's primary source. */
export function Outline({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const requestScrollToPage = useViewStore((s) => s.requestScrollToPage)
  const currentPage = useViewStore((s) => s.currentPage)
  const [initial, setInitial] = useState<OutlineItem[] | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const primarySourceId = tab.sourceIds[0]
  const pdf = primarySourceId ? getSource(primarySourceId)?.pdf : undefined

  useEffect(() => {
    if (!pdf || !primarySourceId) return
    let cancelled = false
    const pages = useDocumentStore.getState().getTab(tab.id)?.pages ?? []
    void buildInitialOutline(pdf, primarySourceId, pages).then((tree) => {
      if (!cancelled) setInitial(tree)
    })
    return () => {
      cancelled = true
    }
  }, [pdf, primarySourceId, tab.id])

  const tree = tab.outline ?? initial

  const edit = (transform: (items: OutlineItem[]) => OutlineItem[], label: string): void => {
    // Never edit before the initial tree has loaded — editing against a spurious
    // empty baseline would silently discard the document's existing bookmarks.
    const base = tab.outline ?? initial
    if (base === null) return
    const after = transform(base)
    // Undo target is the genuine prior value (null before the first edit), so
    // undoing the first edit restores the original-pass-through state.
    if (after !== base) commitOutline(tab.id, tab.outline, after, label)
  }

  const cb: RowCallbacks = {
    navigate: (pageKey) => {
      if (!pageKey) return
      const logical = tab.pages.findIndex((page) => page.key === pageKey)
      if (logical >= 0) requestScrollToPage(logical + 1)
    },
    resolves: (pageKey) => pageKey !== null && tab.pages.some((page) => page.key === pageKey),
    rename: (id, title) => edit((items) => renameItem(items, id, title), 'Rename bookmark'),
    remove: (id) => edit((items) => deleteItem(items, id), 'Delete bookmark'),
    move: (id, direction) => edit((items) => moveItem(items, id, direction), 'Move bookmark'),
    indent: (id) => edit((items) => indentItem(items, id), 'Nest bookmark'),
    outdent: (id) => edit((items) => outdentItem(items, id), 'Unnest bookmark')
  }

  const toggleCollapsed = (id: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const addCurrentPage = (): void => {
    const index = Math.min(currentPage, tab.pages.length) - 1
    const ref = tab.pages[index]
    edit(
      (items) => appendItem(items, makeOutlineItem(`Page ${index + 1}`, ref?.key ?? null)),
      'Add bookmark'
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Bookmarks</span>
        <button
          type="button"
          onClick={addCurrentPage}
          disabled={tab.pages.length === 0 || tree === null}
          title="Add a bookmark for the current page"
          className="flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </div>

      {tree === null ? (
        <div className="p-3 text-sm text-muted-foreground">Loading…</div>
      ) : tree.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          No bookmarks yet. “Add” creates one for the page you’re viewing.
        </div>
      ) : (
        <ul className="flex-1 overflow-auto py-1">
          {tree.map((item) => (
            <OutlineRow
              key={item.id}
              item={item}
              depth={0}
              collapsed={collapsed}
              toggleCollapsed={toggleCollapsed}
              cb={cb}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
