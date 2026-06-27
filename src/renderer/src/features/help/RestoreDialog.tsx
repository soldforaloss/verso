import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileClock } from 'lucide-react'
import type { RecoveryEntry } from '@shared/ipc'

/**
 * Offered on launch when a previous session left unsaved work (a crash or forced
 * exit). Each entry can be reopened (with its edits) or discarded.
 */
export function RestoreDialog({
  entries,
  onRestore,
  onDiscard
}: {
  entries: RecoveryEntry[]
  onRestore: (entry: RecoveryEntry) => void
  onDiscard: (entry: RecoveryEntry) => void
}): React.JSX.Element {
  return (
    <Dialog open={entries.length > 0}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recover unsaved changes?</DialogTitle>
          <DialogDescription>
            These documents had unsaved changes when Verso last closed unexpectedly.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <FileClock className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" title={entry.name}>
                  {entry.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Autosaved {new Date(entry.savedAt).toLocaleString()}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onDiscard(entry)}>
                Discard
              </Button>
              <Button size="sm" onClick={() => onRestore(entry)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
