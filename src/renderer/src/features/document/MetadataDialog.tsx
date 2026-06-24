import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { getSource, useDocumentStore, type DocumentTab } from '@/store/documentStore'
import {
  EMPTY_METADATA,
  readMetadata,
  type DocumentMetadata,
  type MetadataDates
} from '@/lib/metadata'

const FIELDS: { key: keyof DocumentMetadata; label: string; placeholder?: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'subject', label: 'Subject' },
  { key: 'keywords', label: 'Keywords', placeholder: 'comma, separated, terms' },
  { key: 'creator', label: 'Creator' },
  { key: 'producer', label: 'Producer' }
]

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString() : '—'
}

export function MetadataDialog({
  tab,
  open,
  onOpenChange
}: {
  tab: DocumentTab
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const setMetadata = useDocumentStore((s) => s.setMetadata)
  const [draft, setDraft] = useState<DocumentMetadata>(EMPTY_METADATA)
  const [dates, setDates] = useState<MetadataDates>({ creationDate: null, modificationDate: null })

  // Seed the form when the dialog opens: prefer pending edits, else read the file.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    if (tab.metadata) setDraft(tab.metadata)
    const sourceId = tab.sourceIds[0]
    const source = sourceId ? getSource(sourceId) : undefined
    if (!source) return
    void readMetadata(source.bytes).then((meta) => {
      if (cancelled) return
      const { creationDate, modificationDate, ...editable } = meta
      setDates({ creationDate, modificationDate })
      if (!tab.metadata) setDraft(editable)
    })
    return () => {
      cancelled = true
    }
  }, [open, tab.metadata, tab.sourceIds])

  const update = (key: keyof DocumentMetadata, value: string): void =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const save = (): void => {
    setMetadata(tab.id, draft)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Document properties</DialogTitle>
          <DialogDescription>
            Edit the document’s metadata. Changes are written when you save the PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {FIELDS.map(({ key, label, placeholder }) => (
            <label key={key} className="grid gap-1 text-sm">
              <span className="font-medium">{label}</span>
              <Input
                value={draft[key]}
                placeholder={placeholder ?? ''}
                onChange={(event) => update(key, event.target.value)}
              />
            </label>
          ))}
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <span>Created: {formatDate(dates.creationDate)}</span>
            <span>Modified: {formatDate(dates.modificationDate)}</span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={save}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
