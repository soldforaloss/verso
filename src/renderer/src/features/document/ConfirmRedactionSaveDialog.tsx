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
import { baseName, saveDocument, withPdfExt } from '@/lib/save'
import { useUiStore } from '@/store/uiStore'
import { useDocumentStore } from '@/store/documentStore'

/**
 * Guards against shipping a document whose redaction marks were never applied —
 * a plain save leaves opaque boxes over text that is still fully recoverable.
 * Offers to apply the redactions (the secure path) before saving, to save anyway
 * (cover-up only), or to cancel.
 */
export function ConfirmRedactionSaveDialog(): React.JSX.Element | null {
  const prompt = useUiStore((s) => s.redactionSavePrompt)
  const setPrompt = useUiStore((s) => s.setRedactionSavePrompt)
  const tab = useDocumentStore((s) => s.tabs.find((t) => t.id === prompt?.tabId))
  const [busy, setBusy] = useState(false)

  if (!prompt || !tab) return null
  const pages = redactedPageNumbers(tab)
  const saveAs = prompt.saveAs

  const close = (): void => setPrompt(null)

  // Apply the redactions (rasterize the marked pages) and save the now-secure
  // document. The destination is chosen BEFORE the irreversible apply, so
  // cancelling the save dialog can't destroy the document without writing it.
  const applyAndSave = async (): Promise<void> => {
    setBusy(true)
    try {
      let path = tab.path
      if (saveAs || !path) {
        path = await window.api.showSaveDialog({ defaultName: withPdfExt(tab.name) })
        if (!path) return // cancelled — nothing rasterized, nothing written
      }
      const bytes = await applyRedactions(tab)
      await useDocumentStore.getState().replaceDocument(tab.id, bytes)
      await window.api.writeFile({ path, bytes })
      useDocumentStore.getState().markSaved(tab.id, path, baseName(path))
      close()
    } catch {
      // A failed apply left the marks intact; a failed write wrote nothing. Close
      // so the user can retry via a normal save (which re-prompts if still marked).
      close()
    } finally {
      setBusy(false)
    }
  }

  const saveAnyway = async (): Promise<void> => {
    setBusy(true)
    try {
      await saveDocument(tab, saveAs)
    } catch {
      /* write failed — nothing was shipped */
    } finally {
      setBusy(false)
    }
    close()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-destructive" />
            Redactions not applied
          </DialogTitle>
          <DialogDescription>
            {pages.length === 1
              ? `Page ${pages[0]} has a redaction mark that hasn't been applied.`
              : `${pages.length} pages have redaction marks that haven't been applied (${pages.join(', ')}).`}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Saving now only draws opaque boxes over the content — the text beneath stays in the file
          and is still selectable and searchable. Apply the redactions to permanently remove it
          before saving.
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void saveAnyway()}>
              Save anyway
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void applyAndSave()}>
              {busy ? 'Applying…' : 'Apply & save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
