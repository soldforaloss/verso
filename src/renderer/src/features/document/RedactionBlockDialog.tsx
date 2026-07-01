import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { applyRedactions, redactedPageNumbers } from '@/lib/redaction'
import { useUiStore } from '@/store/uiStore'
import { useDocumentStore } from '@/store/documentStore'

/**
 * Shown when a non-save write (extract, split, …) is attempted on a document
 * whose redaction marks haven't been applied — writing now would leak the
 * covered text. Offers to apply the redactions (the secure path); the user then
 * retries the operation, or cancels.
 */
export function RedactionBlockDialog(): React.JSX.Element | null {
  const block = useUiStore((s) => s.redactionBlock)
  const setBlock = useUiStore((s) => s.setRedactionBlock)
  const tab = useDocumentStore((s) => s.tabs.find((t) => t.id === block?.tabId))
  const [busy, setBusy] = useState(false)

  if (!block || !tab) return null
  const pages = redactedPageNumbers(tab)

  const close = (): void => setBlock(null)

  const applyNow = async (): Promise<void> => {
    setBusy(true)
    try {
      const bytes = await applyRedactions(tab)
      await useDocumentStore.getState().replaceDocument(tab.id, bytes)
      close()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-destructive" />
            Apply redactions first
          </DialogTitle>
          <DialogDescription>
            {pages.length === 1
              ? `Page ${pages[0]} has a redaction mark that hasn't been applied.`
              : `${pages.length} pages have redaction marks that haven't been applied (${pages.join(', ')}).`}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          This action would write the document with the marked text merely covered by opaque boxes —
          the hidden text stays selectable and searchable. Apply the redactions to permanently
          remove it, then try again.
        </p>

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void applyNow()}>
            {busy ? 'Applying…' : 'Apply redactions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
