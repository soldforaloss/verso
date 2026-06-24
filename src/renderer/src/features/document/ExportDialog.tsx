import { useState } from 'react'
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
import { cn } from '@/lib/utils'
import { useViewStore } from '@/store/viewStore'
import { exportPagesToImages, type ImageFormat } from '@/lib/exportImage'
import type { DocumentTab } from '@/store/documentStore'

const FORMATS: { value: ImageFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' }
]
const SCALES: { value: number; label: string }[] = [
  { value: 1, label: '1× (72 dpi)' },
  { value: 2, label: '2× (144 dpi)' },
  { value: 3, label: '3× (216 dpi)' }
]

function Choice<T extends string | number>({
  options,
  value,
  onChange,
  label
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}): React.JSX.Element {
  return (
    <div className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors',
              value === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ExportDialog({
  tab,
  open,
  onOpenChange
}: {
  tab: DocumentTab
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const currentPage = useViewStore((s) => s.currentPage)
  const [format, setFormat] = useState<ImageFormat>('png')
  const [scale, setScale] = useState(2)
  const [allPages, setAllPages] = useState(false)
  const [busy, setBusy] = useState(false)

  const pageCount = tab.pages.length

  const run = async (): Promise<void> => {
    const pages = allPages
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : [Math.min(Math.max(1, currentPage), pageCount)]
    setBusy(true)
    try {
      const written = await exportPagesToImages(tab, { format, scale, pages })
      if (written > 0) onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export as image</DialogTitle>
          <DialogDescription>
            Render pages to PNG or JPEG. Annotations and filled fields are included.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Choice label="Format" options={FORMATS} value={format} onChange={setFormat} />
          <Choice label="Resolution" options={SCALES} value={scale} onChange={setScale} />
          <Choice
            label="Pages"
            options={[
              { value: 'current', label: `Current page (${currentPage})` },
              { value: 'all', label: `All pages (${pageCount})` }
            ]}
            value={allPages ? 'all' : 'current'}
            onChange={(value) => setAllPages(value === 'all')}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={() => void run()} disabled={busy}>
            {busy ? 'Exporting…' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
