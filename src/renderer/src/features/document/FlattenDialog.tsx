import { useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { buildDocumentPdf } from '@/lib/save'
import { flattenPdfBytes } from '@/lib/flattenPdf'
import { blockWriteIfUnappliedRedactions } from '@/lib/saveGuards'
import { useDocumentStore, type DocumentTab } from '@/store/documentStore'

/**
 * Flattens the document's interactive form fields: the current field values are
 * baked into the page as static content and the fields become non-editable. Also
 * flattens any annotations (they're drawn in during the build). Irreversible — it
 * replaces the in-memory document and forgets undo history.
 */
export function FlattenDialog({
  tab,
  open,
  onOpenChange
}: {
  tab: DocumentTab
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const flatten = async (): Promise<void> => {
    // Flattening bakes the built document — including redaction marks as cover-up
    // boxes over still-live text. Refuse if any are unapplied, or the leak would
    // be permanently baked in (and the marks lost).
    if (blockWriteIfUnappliedRedactions(tab)) {
      onOpenChange(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { bytes, count } = await flattenPdfBytes(await buildDocumentPdf(tab))
      if (count === 0) {
        // Nothing to flatten (e.g. the fields were already flattened). Report it
        // rather than silently closing, so the outcome is never ambiguous.
        setError('This document has no interactive form fields to flatten.')
        return
      }
      await useDocumentStore.getState().replaceDocument(tab.id, bytes)
      onOpenChange(false)
    } catch {
      // Nothing was replaced (the throw is before replaceDocument), so the
      // document is untouched — say so instead of closing as if it worked.
      setError('Flattening failed — the document was left unchanged.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-5" />
            Flatten form fields
          </DialogTitle>
          <DialogDescription>
            Bakes the current field values into the page and removes the interactive fields, so the
            form can no longer be edited.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          The values stay as selectable text, and other content is untouched. This replaces the
          document and can&apos;t be undone — save afterwards to keep the flattened file.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void flatten()}>
            {busy ? 'Flattening…' : 'Flatten'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
