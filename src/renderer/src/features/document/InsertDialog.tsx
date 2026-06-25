import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { addPageNumbers, addWatermark, type PageNumberPosition } from '@/lib/pageText'
import type { DocumentTab } from '@/store/documentStore'

const COLORS = ['#9ca3af', '#111827', '#dc2626', '#1d4ed8']
const OPACITIES: { label: string; value: number }[] = [
  { label: 'Light', value: 0.12 },
  { label: 'Medium', value: 0.25 },
  { label: 'Strong', value: 0.4 }
]
const POSITIONS: { label: string; value: PageNumberPosition }[] = [
  { label: 'Bottom center', value: 'bottom-center' },
  { label: 'Bottom right', value: 'bottom-right' },
  { label: 'Top right', value: 'top-right' }
]

function Swatches({
  value,
  onChange
}: {
  value: string
  onChange: (color: string) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Color ${color}`}
          onClick={() => onChange(color)}
          className={cn(
            'size-5 rounded-full border',
            value === color ? 'ring-2 ring-ring ring-offset-1 ring-offset-background' : ''
          )}
          style={{ background: color }}
        />
      ))}
    </div>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="grid gap-2 border-t pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

export function InsertDialog({
  tab,
  open,
  onOpenChange
}: {
  tab: DocumentTab
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  const [wmText, setWmText] = useState('CONFIDENTIAL')
  const [wmOpacity, setWmOpacity] = useState(0.25)
  const [wmSize, setWmSize] = useState(60)
  const [wmColor, setWmColor] = useState(COLORS[0]!)

  const [pnStart, setPnStart] = useState(1)
  const [pnSize, setPnSize] = useState(12)
  const [pnPosition, setPnPosition] = useState<PageNumberPosition>('bottom-center')
  const [pnColor, setPnColor] = useState(COLORS[1]!)

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try {
      await action()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Insert across pages</DialogTitle>
          <DialogDescription>
            Add a watermark or page numbers to every page. Both are undoable and flatten on save.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Section title="Watermark">
            <Input
              value={wmText}
              placeholder="Watermark text"
              onChange={(event) => setWmText(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                {OPACITIES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={wmOpacity === o.value}
                    onClick={() => setWmOpacity(o.value)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs transition-colors',
                      wmOpacity === o.value ? 'border-primary bg-accent' : 'hover:bg-accent'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Size
                <Input
                  type="number"
                  className="w-16"
                  value={wmSize}
                  onChange={(event) => setWmSize(Number.parseInt(event.target.value, 10) || 60)}
                />
              </label>
              <Swatches value={wmColor} onChange={setWmColor} />
            </div>
            <Button
              className="justify-self-start"
              disabled={busy || wmText.trim() === ''}
              onClick={() =>
                void run(() =>
                  addWatermark(tab, {
                    text: wmText,
                    opacity: wmOpacity,
                    fontSize: wmSize,
                    color: wmColor
                  })
                )
              }
            >
              Add watermark
            </Button>
          </Section>

          <Section title="Page numbers">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Start at
                <Input
                  type="number"
                  className="w-16"
                  value={pnStart}
                  onChange={(event) => setPnStart(Number.parseInt(event.target.value, 10) || 1)}
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Size
                <Input
                  type="number"
                  className="w-16"
                  value={pnSize}
                  onChange={(event) => setPnSize(Number.parseInt(event.target.value, 10) || 12)}
                />
              </label>
              <Swatches value={pnColor} onChange={setPnColor} />
            </div>
            <div className="flex flex-wrap gap-1">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={pnPosition === p.value}
                  onClick={() => setPnPosition(p.value)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs transition-colors',
                    pnPosition === p.value ? 'border-primary bg-accent' : 'hover:bg-accent'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              className="justify-self-start"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  addPageNumbers(tab, {
                    start: pnStart,
                    fontSize: pnSize,
                    position: pnPosition,
                    color: pnColor
                  })
                )
              }
            >
              Add page numbers
            </Button>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
