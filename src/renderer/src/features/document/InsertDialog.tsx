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
import {
  addHeaderFooter,
  addPageNumbers,
  addWatermark,
  formatPageLabel,
  type HeaderFooterSlots,
  type PageNumberPosition
} from '@/lib/pageText'
import { HEADER_FOOTER_SLOTS } from '@/lib/headerFooter'
import type { DocumentTab } from '@/store/documentStore'

type NumberStyle = 'plain' | 'page-of' | 'bates'
const NUMBER_STYLES: { label: string; value: NumberStyle }[] = [
  { label: 'Number', value: 'plain' },
  { label: 'Page N of M', value: 'page-of' },
  { label: 'Bates', value: 'bates' }
]

/** Resolves a numbering style + Bates fields into a label template + padding. */
function numberFormat(
  style: NumberStyle,
  prefix: string,
  suffix: string,
  digits: number
): { format: string; digits: number } {
  if (style === 'page-of') return { format: 'Page {n} of {total}', digits: 0 }
  if (style === 'bates') return { format: `${prefix}{n}${suffix}`, digits }
  return { format: '{n}', digits: 0 }
}

const WATERMARK_ANGLES: { label: string; value: number }[] = [
  { label: 'Diagonal ↗', value: 45 },
  { label: 'Diagonal ↘', value: -45 },
  { label: 'Horizontal', value: 0 }
]

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

const EMPTY_HF: HeaderFooterSlots = {
  headerLeft: '',
  headerCenter: '',
  headerRight: '',
  footerLeft: '',
  footerCenter: '',
  footerRight: ''
}

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
  const [wmAngle, setWmAngle] = useState(45)

  const [pnStart, setPnStart] = useState(1)
  const [pnSize, setPnSize] = useState(12)
  const [pnPosition, setPnPosition] = useState<PageNumberPosition>('bottom-center')
  const [pnColor, setPnColor] = useState(COLORS[1]!)
  const [pnStyle, setPnStyle] = useState<NumberStyle>('plain')
  const [pnPrefix, setPnPrefix] = useState('')
  const [pnSuffix, setPnSuffix] = useState('')
  const [pnDigits, setPnDigits] = useState(6)

  const [hf, setHf] = useState<HeaderFooterSlots>(EMPTY_HF)
  const [hfSize, setHfSize] = useState(10)
  const [hfColor, setHfColor] = useState(COLORS[1]!)
  const hfEmpty = Object.values(hf).every((value) => value.trim() === '')

  const pnFormat = numberFormat(pnStyle, pnPrefix, pnSuffix, pnDigits)
  const pnPreview = formatPageLabel(
    pnFormat.format,
    0,
    pnStart,
    tab.pages.length || 1,
    pnFormat.digits
  )

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
            Add a watermark, page numbers, Bates numbering, or headers &amp; footers to every page.
            All are undoable and flatten on save.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
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
            <div className="flex flex-wrap gap-1">
              {WATERMARK_ANGLES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  aria-pressed={wmAngle === a.value}
                  onClick={() => setWmAngle(a.value)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs transition-colors',
                    wmAngle === a.value ? 'border-primary bg-accent' : 'hover:bg-accent'
                  )}
                >
                  {a.label}
                </button>
              ))}
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
                    color: wmColor,
                    angle: wmAngle
                  })
                )
              }
            >
              Add watermark
            </Button>
          </Section>

          <Section title="Page numbers & Bates">
            <div className="flex flex-wrap gap-1">
              {NUMBER_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={pnStyle === s.value}
                  onClick={() => setPnStyle(s.value)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs transition-colors',
                    pnStyle === s.value ? 'border-primary bg-accent' : 'hover:bg-accent'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {pnStyle === 'bates' && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  Prefix
                  <Input
                    className="w-24"
                    value={pnPrefix}
                    placeholder="ACME-"
                    onChange={(event) => setPnPrefix(event.target.value)}
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  Suffix
                  <Input
                    className="w-24"
                    value={pnSuffix}
                    onChange={(event) => setPnSuffix(event.target.value)}
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  Digits
                  <Input
                    type="number"
                    className="w-16"
                    value={pnDigits}
                    onChange={(event) =>
                      setPnDigits(
                        Math.max(1, Math.min(12, Number.parseInt(event.target.value, 10) || 6))
                      )
                    }
                  />
                </label>
              </div>
            )}

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
            <p className="text-xs text-muted-foreground">
              Preview: <span className="font-medium text-foreground">{pnPreview}</span>
            </p>
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
                    color: pnColor,
                    format: pnFormat.format,
                    digits: pnFormat.digits
                  })
                )
              }
            >
              {pnStyle === 'bates' ? 'Add Bates numbers' : 'Add page numbers'}
            </Button>
          </Section>

          <Section title="Header & footer">
            <p className="text-xs text-muted-foreground">
              Tokens: <code className="font-mono">{'{page}'}</code>{' '}
              <code className="font-mono">{'{pages}'}</code>{' '}
              <code className="font-mono">{'{date}'}</code>{' '}
              <code className="font-mono">{'{filename}'}</code>
            </p>
            {(['header', 'footer'] as const).map((band) => (
              <div key={band} className="grid grid-cols-3 gap-1.5">
                {HEADER_FOOTER_SLOTS.filter((s) => s.band === band).map((s) => (
                  <Input
                    key={s.slot}
                    aria-label={`${s.band} ${s.align}`}
                    className="text-xs"
                    placeholder={`${band === 'header' ? 'Header' : 'Footer'} ${s.align}`}
                    value={hf[s.slot]}
                    onChange={(event) =>
                      setHf((prev) => ({ ...prev, [s.slot]: event.target.value }))
                    }
                  />
                ))}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Size
                <Input
                  type="number"
                  className="w-16"
                  min={4}
                  max={96}
                  value={hfSize}
                  onChange={(event) =>
                    setHfSize(
                      Math.max(4, Math.min(96, Number.parseInt(event.target.value, 10) || 10))
                    )
                  }
                />
              </label>
              <Swatches value={hfColor} onChange={setHfColor} />
            </div>
            <Button
              variant="secondary"
              className="justify-self-start"
              disabled={busy || hfEmpty}
              onClick={() =>
                void run(() => addHeaderFooter(tab, { ...hf, fontSize: hfSize, color: hfColor }))
              }
            >
              Add header &amp; footer
            </Button>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
