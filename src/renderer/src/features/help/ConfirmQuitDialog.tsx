import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/store/uiStore'

/**
 * Shown when the window is closing with unsaved changes. "Discard & quit" tells
 * the main process to proceed with the close; "Cancel" keeps the app open.
 */
export function ConfirmQuitDialog(): React.JSX.Element {
  const open = useUiStore((s) => s.quitConfirmOpen)
  const setOpen = useUiStore((s) => s.setQuitConfirmOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>
            One or more documents have unsaved changes. If you quit now, those changes will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false)
              void window.api.allowClose()
            }}
          >
            Discard &amp; quit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
