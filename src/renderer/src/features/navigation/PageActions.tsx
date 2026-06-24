import { Copy, FilePlus2, FileUp, RotateCcw, RotateCw, Scissors, Split, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSelectionStore } from '@/store/selectionStore'
import { useViewStore } from '@/store/viewStore'
import type { DocumentTab } from '@/store/documentStore'
import {
  deletePages,
  duplicatePages,
  insertBlankPage,
  insertPagesFromBytes,
  rotatePages
} from '@/lib/pageOps'
import { extractPages, splitDocument } from '@/lib/save'

function Divider(): React.JSX.Element {
  return <div className="mx-0.5 h-5 w-px bg-border" />
}

/** Page operations acting on the current selection (or the current page). */
export function PageActions({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const selected = useSelectionStore((s) => s.selected)
  const currentPage = useViewStore((s) => s.currentPage)

  const targets = selected.length > 0 ? selected : [Math.min(currentPage, tab.pages.length) - 1]
  const insertAt = selected.length > 0 ? Math.max(...selected) + 1 : currentPage

  const insertPdf = async (): Promise<void> => {
    const doc = await window.api.openFileDialog()
    if (doc) await insertPagesFromBytes(tab.id, insertAt, doc.bytes)
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b p-1">
      <Button
        variant="ghost"
        size="icon"
        title="Rotate left"
        onClick={() => rotatePages(tab.id, targets, -90)}
      >
        <RotateCcw />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Rotate right"
        onClick={() => rotatePages(tab.id, targets, 90)}
      >
        <RotateCw />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Duplicate"
        onClick={() => duplicatePages(tab.id, targets)}
      >
        <Copy />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Delete"
        disabled={tab.pages.length <= targets.length}
        onClick={() => deletePages(tab.id, targets)}
      >
        <Trash2 />
      </Button>

      <Divider />

      <Button
        variant="ghost"
        size="icon"
        title="Insert blank page"
        onClick={() => insertBlankPage(tab.id, insertAt)}
      >
        <FilePlus2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Insert pages from PDF…"
        onClick={() => void insertPdf()}
      >
        <FileUp />
      </Button>

      <Divider />

      <Button
        variant="ghost"
        size="icon"
        title="Extract selection to a new PDF…"
        onClick={() => void extractPages(tab, targets)}
      >
        <Scissors />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Split into one PDF per page…"
        onClick={() => void splitDocument(tab)}
      >
        <Split />
      </Button>
    </div>
  )
}
