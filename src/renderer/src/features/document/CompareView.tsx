import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getSource, type DocumentTab } from '@/store/documentStore'
import { loadPdfDocument, type PdfDocument, type RenderTask } from '@/lib/pdf'
import { diffImages, type DiffResult } from '@/lib/pdfCompare'
import { diffWords, type DiffSummary } from '@/lib/textDiff'

type Mode = 'visual' | 'text'

async function pageText(pdf: PdfDocument, n: number): Promise<string | null> {
  if (n < 1 || n > pdf.numPages) return null
  const page = await pdf.getPage(n)
  const content = await page.getTextContent()
  return content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
}

const TARGET_WIDTH = 460
const RENDERING_CANCELLED = 'RenderingCancelledException'

interface Rendered {
  imageData: ImageData
  width: number
  height: number
}

function blit(canvas: HTMLCanvasElement | null, image: ImageData | null): void {
  if (!canvas) return
  if (!image) {
    canvas.width = 0
    canvas.height = 0
    return
  }
  canvas.width = image.width
  canvas.height = image.height
  canvas.getContext('2d')?.putImageData(image, 0, 0)
}

/** Side-by-side visual comparison of the open document against another PDF. */
export function CompareView({
  tab,
  otherBytes,
  otherName,
  onClose
}: {
  tab: DocumentTab
  otherBytes: Uint8Array
  otherName: string
  onClose: () => void
}): React.JSX.Element {
  const basePdf = getSource(tab.sourceIds[0] ?? '')?.pdf
  const [otherPdf, setOtherPdf] = useState<PdfDocument | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [mode, setMode] = useState<Mode>('visual')
  const [showDiff, setShowDiff] = useState(true)
  const [changedRatio, setChangedRatio] = useState<number | null>(null)
  const [textDiff, setTextDiff] = useState<DiffSummary | null>(null)
  const [status, setStatus] = useState('')
  const leftRef = useRef<HTMLCanvasElement>(null)
  const rightRef = useRef<HTMLCanvasElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Cache the current page's rendered "other" image + diff so toggling the
  // highlight only re-blits instead of re-rendering both PDFs.
  const cache = useRef<{ other: Rendered | null; diff: DiffResult | null }>({
    other: null,
    diff: null
  })
  const showDiffRef = useRef(showDiff)
  showDiffRef.current = showDiff

  const pageCount = Math.max(basePdf?.numPages ?? 0, otherPdf?.numPages ?? 0)
  const pageCountRef = useRef(pageCount)
  pageCountRef.current = pageCount
  const go = (delta: number): void =>
    setPageNumber((n) => Math.min(Math.max(1, n + delta), Math.max(1, pageCount)))

  // Load the comparison document (and surface an error if it can't be opened).
  useEffect(() => {
    let cancelled = false
    let destroy: (() => Promise<void>) | null = null
    void loadPdfDocument(otherBytes).then(
      (loaded) => {
        if (cancelled) {
          void loaded.destroy()
          return
        }
        destroy = loaded.destroy
        setOtherPdf(loaded.pdf)
      },
      () => {
        if (!cancelled) setStatus('Could not open that PDF for comparison.')
      }
    )
    return () => {
      cancelled = true
      void destroy?.()
    }
  }, [otherBytes])

  // Render the current page from each document and compute the visual diff.
  useEffect(() => {
    if (!basePdf || !otherPdf || mode !== 'visual') return
    let cancelled = false
    const tasks: RenderTask[] = []

    const render = async (pdf: PdfDocument, n: number, scale: number): Promise<Rendered | null> => {
      if (n < 1 || n > pdf.numPages) return null
      const page = await pdf.getPage(n)
      if (cancelled) return null
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null
      const task = page.render({ canvas, viewport })
      tasks.push(task)
      await task.promise
      return {
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        width: canvas.width,
        height: canvas.height
      }
    }

    void (async () => {
      try {
        setStatus('Rendering…')
        // Scale both documents identically so the pixel diff is meaningful.
        const samplePdf = pageNumber <= basePdf.numPages ? basePdf : otherPdf
        const sample = await samplePdf.getPage(Math.min(pageNumber, samplePdf.numPages))
        if (cancelled) return
        const scale = TARGET_WIDTH / Math.max(1, sample.getViewport({ scale: 1 }).width)

        const [a, b] = await Promise.all([
          render(basePdf, pageNumber, scale),
          render(otherPdf, pageNumber, scale)
        ])
        if (cancelled) return

        blit(leftRef.current, a?.imageData ?? null)
        if (a && b) {
          const diff = diffImages(
            { data: a.imageData.data, width: a.width, height: a.height },
            { data: b.imageData.data, width: b.width, height: b.height }
          )
          cache.current = { other: b, diff }
          setChangedRatio(diff.changedRatio)
          blit(
            rightRef.current,
            showDiffRef.current ? new ImageData(diff.data, diff.width, diff.height) : b.imageData
          )
          setStatus(diff.sizeMismatch ? 'Page sizes differ' : '')
        } else {
          cache.current = { other: b, diff: null }
          setChangedRatio(null)
          blit(rightRef.current, b?.imageData ?? null)
          setStatus(a ? 'Page only in this document' : 'Page only in the other document')
        }
      } catch (error) {
        if (!cancelled && (error as Error)?.name !== RENDERING_CANCELLED) {
          setStatus('Failed to render this page.')
        }
      }
    })()

    return () => {
      cancelled = true
      for (const task of tasks) task.cancel()
    }
  }, [basePdf, otherPdf, pageNumber, mode])

  // Extract and diff the page text (text mode).
  useEffect(() => {
    if (!basePdf || !otherPdf || mode !== 'text') return
    let cancelled = false
    void (async () => {
      try {
        setStatus('Reading text…')
        const [a, b] = await Promise.all([
          pageText(basePdf, pageNumber),
          pageText(otherPdf, pageNumber)
        ])
        if (cancelled) return
        setTextDiff(diffWords(a ?? '', b ?? ''))
        setStatus('')
      } catch {
        if (!cancelled) setStatus('Failed to read this page.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [basePdf, otherPdf, pageNumber, mode])

  // Toggle the highlight without re-rendering — just re-blit from the cache.
  useEffect(() => {
    const { other, diff } = cache.current
    if (showDiff && diff) blit(rightRef.current, new ImageData(diff.data, diff.width, diff.height))
    else if (other) blit(rightRef.current, other.imageData)
  }, [showDiff])

  // Own the keyboard while open: Escape closes, arrows page, and every other key
  // is swallowed so document shortcuts don't fire on the hidden editor beneath.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      event.stopPropagation()
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        setPageNumber((n) => Math.max(1, n - 1))
      } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        setPageNumber((n) => Math.min(n + 1, Math.max(1, pageCountRef.current)))
      }
    }
    window.addEventListener('keydown', onKey, true)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-title"
      className="fixed inset-0 z-40 flex flex-col bg-background"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span id="compare-title" className="text-sm font-medium">
          Compare
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {tab.name} ↔ {otherName}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Previous page"
            disabled={pageNumber <= 1}
            onClick={() => go(-1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm tabular-nums">
            {pageNumber} / {pageCount}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Next page"
            disabled={pageNumber >= pageCount}
            onClick={() => go(1)}
          >
            <ChevronRight />
          </Button>
          <div className="flex items-center rounded-md border p-0.5">
            {(['visual', 'text'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-[5px] px-2 py-0.5 text-xs capitalize transition-colors',
                  mode === m ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent'
                )}
              >
                {m}
              </button>
            ))}
          </div>
          {mode === 'visual' && (
            <Button
              size="sm"
              variant={showDiff ? 'secondary' : 'ghost'}
              aria-pressed={showDiff}
              onClick={() => setShowDiff((v) => !v)}
            >
              Highlight changes
            </Button>
          )}
          <span
            data-testid="compare-changed"
            className="min-w-24 px-1 text-center text-xs tabular-nums text-muted-foreground"
          >
            {mode === 'text'
              ? textDiff === null
                ? status || '—'
                : textDiff.added === 0 && textDiff.removed === 0
                  ? 'No text changes'
                  : `+${textDiff.added} −${textDiff.removed}`
              : changedRatio === null
                ? status || '—'
                : changedRatio === 0
                  ? 'No changes'
                  : `${(changedRatio * 100).toFixed(1)}% changed`}
          </span>
          <Button
            ref={closeRef}
            size="icon"
            variant="ghost"
            title="Close compare"
            aria-label="Close compare"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-auto bg-neutral-200 p-4 dark:bg-neutral-900">
        {mode === 'visual' ? (
          <>
            <figure className="flex flex-1 flex-col items-center gap-1">
              <figcaption className="text-xs text-muted-foreground">{tab.name}</figcaption>
              <canvas ref={leftRef} className="max-w-full bg-white shadow ring-1 ring-black/10" />
            </figure>
            <figure className="flex flex-1 flex-col items-center gap-1">
              <figcaption className="text-xs text-muted-foreground">
                {showDiff ? 'Changes' : otherName}
              </figcaption>
              <canvas ref={rightRef} className="max-w-full bg-white shadow ring-1 ring-black/10" />
            </figure>
          </>
        ) : (
          <div
            data-testid="compare-text"
            className="mx-auto h-fit max-w-3xl flex-1 whitespace-pre-wrap break-words rounded-md border bg-card p-4 text-sm leading-relaxed"
          >
            {textDiff === null ? (
              <span className="text-muted-foreground">{status || 'Reading…'}</span>
            ) : textDiff.runs.length === 0 ? (
              <span className="text-muted-foreground">No text on this page.</span>
            ) : (
              textDiff.runs.map((run, index) => (
                <span
                  key={index}
                  className={cn(
                    run.type === 'add' &&
                      'rounded bg-green-500/25 text-green-900 dark:text-green-200',
                    run.type === 'remove' &&
                      'rounded bg-red-500/25 text-red-900 line-through dark:text-red-200'
                  )}
                >
                  {run.text}{' '}
                </span>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
