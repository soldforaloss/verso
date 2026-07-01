import { useState } from 'react'
import { ChevronDown, ChevronUp, FilePlus2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { combinePdfs } from '@/lib/combine'
import { useDocumentStore } from '@/store/documentStore'

interface Entry {
  name: string
  bytes: Uint8Array
}

/**
 * Combine Files: pick several PDFs, order them, and merge into one new document
 * (opened in a fresh tab). Page order follows the list top-to-bottom.
 */
export function CombineDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [files, setFiles] = useState<Entry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = (): void => {
    setFiles([])
    setError(null)
    setBusy(false)
  }

  const addFile = async (): Promise<void> => {
    const doc = await window.api.openFileDialog()
    if (doc) setFiles((prev) => [...prev, { name: doc.name, bytes: doc.bytes }])
  }

  const move = (index: number, delta: -1 | 1): void => {
    setFiles((prev) => {
      const next = prev.slice()
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      return next
    })
  }

  const removeAt = (index: number): void => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const combine = async (): Promise<void> => {
    if (files.length < 2) return
    // Everything is merged in the renderer's heap; guard against an OOM from
    // combining many very large PDFs.
    const total = files.reduce((sum, f) => sum + f.bytes.byteLength, 0)
    if (total > 512 * 1024 * 1024) {
      setError('These files are too large to combine (over 512 MB total).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const bytes = await combinePdfs(files.map((f) => f.bytes))
      await useDocumentStore.getState().openDocument({
        id: globalThis.crypto.randomUUID(),
        name: 'Combined.pdf',
        path: null,
        bytes
      })
      reset()
      onOpenChange(false)
    } catch {
      setError('One of the files could not be read as a PDF. Remove it and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Combine files</DialogTitle>
          <DialogDescription>
            Merge several PDFs into one new document, in the order below. Form fields are flattened
            to their current values.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {files.length === 0 ? (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              No files yet — add two or more PDFs to combine.
            </p>
          ) : (
            <ul className="grid max-h-[45vh] gap-1 overflow-y-auto">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
                >
                  <span className="w-5 text-center tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate" title={file.name}>
                    {file.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    title="Move down"
                    disabled={index === files.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive hover:text-destructive"
                    title="Remove"
                    onClick={() => removeAt(index)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Button variant="secondary" className="justify-self-start" onClick={() => void addFile()}>
            <FilePlus2 className="mr-1 size-4" /> Add PDF
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || files.length < 2} onClick={() => void combine()}>
            {busy ? 'Combining…' : `Combine ${files.length || ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
