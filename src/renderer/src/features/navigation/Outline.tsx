import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { getDocumentPdf, type DocumentTab } from '@/store/documentStore'
import { useViewStore } from '@/store/viewStore'
import type { PdfDocument } from '@/lib/pdf'
import { cn } from '@/lib/utils'

type OutlineNode = Awaited<ReturnType<PdfDocument['getOutline']>>[number]
type Destination = OutlineNode['dest']

/** Resolves an outline destination to a 1-based page number, if possible. */
async function destinationToPage(pdf: PdfDocument, dest: Destination): Promise<number | null> {
  if (!dest) return null
  const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest
  if (!Array.isArray(explicit) || explicit.length === 0) return null
  try {
    const index = await pdf.getPageIndex(explicit[0] as Parameters<PdfDocument['getPageIndex']>[0])
    return index + 1
  } catch {
    return null
  }
}

function OutlineItem({
  node,
  depth,
  onNavigate
}: {
  node: OutlineNode
  depth: number
  onNavigate: (dest: Destination) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(depth < 1)
  const hasChildren = node.items.length > 0

  return (
    <li>
      <div className="flex items-center gap-0.5" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <button
          type="button"
          className="flex-1 truncate rounded px-1 py-1 text-left text-sm hover:bg-accent"
          title={node.title}
          onClick={() => onNavigate(node.dest)}
        >
          {node.title}
        </button>
      </div>
      {open && hasChildren && (
        <ul>
          {node.items.map((child, index) => (
            <OutlineItem key={index} node={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Document outline (bookmarks) panel; click a heading to navigate. */
export function Outline({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const pdf = getDocumentPdf(tab.id)
  const requestScrollToPage = useViewStore((s) => s.requestScrollToPage)
  const [outline, setOutline] = useState<OutlineNode[] | null>(null)

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    void pdf.getOutline().then((nodes) => {
      if (!cancelled) setOutline(nodes ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [pdf])

  const onNavigate = (dest: Destination): void => {
    if (!pdf) return
    void destinationToPage(pdf, dest).then((page) => {
      if (page) requestScrollToPage(page)
    })
  }

  if (outline === null) {
    return <div className="p-3 text-sm text-muted-foreground">Loading…</div>
  }
  if (outline.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">This document has no bookmarks.</div>
  }

  return (
    <ul className="overflow-auto py-1 pr-1">
      {outline.map((node, index) => (
        <OutlineItem key={index} node={node} depth={0} onNavigate={onNavigate} />
      ))}
    </ul>
  )
}
