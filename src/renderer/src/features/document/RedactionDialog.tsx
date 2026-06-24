import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { applyRedactions, redactedPageNumbers } from '@/lib/redaction'
import { useDocumentStore, type DocumentTab } from '@/store/documentStore'

export function RedactionDialog({
  tab,
  open,
  onOpenChange
}: {
  tab: DocumentTab
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const pages = redactedPageNumbers(tab)

  const apply = async (): Promise<void> => {
    setBusy(true)
    try {
      const bytes = await applyRedactions(tab)
      await useDocumentStore.getState().replaceDocument(tab.id, bytes)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-destructive" />
            Apply redactions
          </DialogTitle>
          <DialogDescription>
            This permanently destroys content and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <p>
            {pages.length === 1
              ? `Page ${pages[0]} has a redaction mark.`
              : `${pages.length} pages have redaction marks (${pages.join(', ')}).`}
          </p>
          <p className="text-muted-foreground">
            Each affected page is <strong>flattened to an image</strong> with the marked regions
            blacked out, so the text and hidden data beneath them are removed entirely — not merely
            hidden. As a result, those pages lose their selectable text. Other pages are untouched.
            Save the document afterwards to write the redacted file to disk.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => void apply()} disabled={busy}>
            {busy ? 'Redacting…' : 'Redact permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
