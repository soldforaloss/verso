import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getSource, type DocumentTab } from '@/store/documentStore'
import { useViewStore } from '@/store/viewStore'
import { cropPages } from '@/lib/pageOps'
import { cropFromMargins, type CropBox, type CropMargins } from '@/lib/pageModel'

interface PageSize {
  width: number
  height: number
}

const ZERO: CropMargins = { top: 0, right: 0, bottom: 0, left: 0 }

/** Natural (unrotated) size of a source page, or null for blank/missing pages. */
async function sourcePageSize(tab: DocumentTab, index: number): Promise<PageSize | null> {
  const ref = tab.pages[index]
  if (!ref || ref.kind !== 'source') return null
  const source = getSource(ref.sourceId)
  if (!source) return null
  const page = await source.pdf.getPage(ref.sourceIndex + 1)
  const viewport = page.getViewport({ scale: 1, rotation: 0 })
  return { width: viewport.width, height: viewport.height }
}

interface CropDialogProps {
  tab: DocumentTab
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EDGES = [
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' }
] as const

/**
 * Trims page margins by setting a crop box on the page model (applied via
 * pdf-lib `setCropBox` on save). Crop is defined on the unrotated page, in
 * percentages, so "crop all pages" works across pages of differing size.
 */
export function CropDialog({ tab, open, onOpenChange }: CropDialogProps): React.JSX.Element {
  const currentPage = useViewStore((s) => s.currentPage)
  const pageIndex = Math.min(currentPage, tab.pages.length) - 1
  const [size, setSize] = useState<PageSize>({ width: 612, height: 792 })
  const [margins, setMargins] = useState<CropMargins>(ZERO)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const measured = await sourcePageSize(tab, pageIndex)
      if (cancelled || !measured) return
      setSize(measured)
      const ref = tab.pages[pageIndex]
      const crop = ref && ref.kind === 'source' ? ref.crop : null
      setMargins(
        crop
          ? {
              left: crop.x / measured.width,
              bottom: crop.y / measured.height,
              right: (measured.width - crop.x - crop.width) / measured.width,
              top: (measured.height - crop.y - crop.height) / measured.height
            }
          : ZERO
      )
    })()
    return () => {
      cancelled = true
    }
  }, [open, tab, pageIndex])

  const setEdge = (key: keyof CropMargins, percent: number): void =>
    setMargins((m) => ({ ...m, [key]: Math.min(Math.max(percent, 0), 45) / 100 }))

  const isSource = tab.pages[pageIndex]?.kind === 'source'
  const trimsNothing = margins.top + margins.bottom >= 1 || margins.left + margins.right >= 1

  const applyToCurrent = (): void => {
    cropPages(tab.id, { [pageIndex]: cropFromMargins(size, margins) }, 'Crop page')
    onOpenChange(false)
  }

  const applyToAll = async (): Promise<void> => {
    const map: Record<number, CropBox> = {}
    for (let index = 0; index < tab.pages.length; index += 1) {
      const measured = await sourcePageSize(tab, index)
      if (measured) map[index] = cropFromMargins(measured, margins)
    }
    cropPages(tab.id, map, 'Crop all pages')
    onOpenChange(false)
  }

  const clearCurrent = (): void => {
    cropPages(tab.id, { [pageIndex]: null }, 'Remove crop')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crop pages</DialogTitle>
          <DialogDescription>
            Trim the margins of page {pageIndex + 1}. Applied losslessly on save; clear it any time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-5">
          {/* Schematic preview: the kept region within the page outline. */}
          <div className="flex w-40 shrink-0 items-center justify-center">
            <div
              className="relative w-full rounded-sm bg-muted ring-1 ring-border"
              style={{ aspectRatio: `${size.width} / ${size.height}` }}
            >
              <div
                className="absolute rounded-[1px] border-2 border-primary bg-background/80"
                style={{
                  top: `${margins.top * 100}%`,
                  bottom: `${margins.bottom * 100}%`,
                  left: `${margins.left * 100}%`,
                  right: `${margins.right * 100}%`
                }}
              />
            </div>
          </div>

          <div className="grid flex-1 gap-3">
            {EDGES.map(({ key, label }) => (
              <label key={key} className="grid gap-1 text-sm">
                <span className="flex items-center justify-between">
                  <span>{label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round(margins[key] * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  aria-label={`${label} margin`}
                  min={0}
                  max={45}
                  step={1}
                  value={Math.round(margins[key] * 100)}
                  onChange={(event) => setEdge(key, Number.parseFloat(event.target.value))}
                  className="h-1 w-full cursor-pointer accent-primary"
                />
              </label>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button variant="ghost" onClick={clearCurrent}>
            Remove crop
          </Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="secondary"
              disabled={!isSource || trimsNothing}
              onClick={() => void applyToAll()}
            >
              Crop all pages
            </Button>
            <Button disabled={!isSource || trimsNothing} onClick={applyToCurrent}>
              Crop page
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
