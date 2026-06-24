import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { getDocumentPdf, type DocumentTab } from '@/store/documentStore'
import { useViewStore } from '@/store/viewStore'
import type { PdfDocument, RenderTask } from '@/lib/pdf'
import { cn } from '@/lib/utils'

const THUMB_WIDTH = 132

interface ThumbnailProps {
  pdf: PdfDocument
  pageNumber: number
  isActive: boolean
  scrollRoot: HTMLElement | null
  onSelect: (pageNumber: number) => void
}

function ThumbnailImpl({
  pdf,
  pageNumber,
  isActive,
  scrollRoot,
  onSelect
}: ThumbnailProps): React.JSX.Element {
  const wrapperRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const taskRef = useRef<RenderTask | null>(null)
  const [visible, setVisible] = useState(false)
  // Reserve roughly Letter aspect until the real page is measured.
  const [height, setHeight] = useState(THUMB_WIDTH * 1.294)

  useEffect(() => {
    const element = wrapperRef.current
    if (!element || !scrollRoot) return
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => setVisible(entry.isIntersecting)),
      { root: scrollRoot, rootMargin: '400px 0px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const scale = THUMB_WIDTH / base.width
        const viewport = page.getViewport({ scale })
        setHeight(viewport.height)
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        taskRef.current?.cancel()
        const params: Parameters<typeof page.render>[0] = { canvas, viewport }
        if (dpr !== 1) params.transform = [dpr, 0, 0, dpr, 0, 0]
        const task = page.render(params)
        taskRef.current = task
        await task.promise
        if (!cancelled) page.cleanup()
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'RenderingCancelledException') {
          console.error(`[thumbnails] page ${pageNumber} failed:`, error)
        }
      }
    })()
    return () => {
      cancelled = true
      taskRef.current?.cancel()
      taskRef.current = null
    }
  }, [visible, pdf, pageNumber])

  return (
    <button
      ref={wrapperRef}
      type="button"
      onClick={() => onSelect(pageNumber)}
      className="flex flex-col items-center gap-1 rounded-md p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-current={isActive}
    >
      <div
        className={cn(
          'overflow-hidden rounded-sm bg-white ring-1 transition-shadow',
          isActive ? 'ring-2 ring-primary' : 'ring-black/15'
        )}
        style={{ width: THUMB_WIDTH, height }}
      >
        <canvas ref={canvasRef} className="block" />
      </div>
      <span
        className={cn(
          'text-xs tabular-nums',
          isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
        )}
      >
        {pageNumber}
      </span>
    </button>
  )
}

const Thumbnail = memo(ThumbnailImpl)

/** Lazy-rendered thumbnail rail with current-page sync and click-to-jump. */
export function Thumbnails({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const pdf = getDocumentPdf(tab.id)
  const currentPage = useViewStore((s) => s.currentPage)
  const requestScrollToPage = useViewStore((s) => s.requestScrollToPage)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setScrollRoot(scrollRef.current)
  }, [])

  // Keep the active thumbnail in view as the user scrolls the document.
  useEffect(() => {
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-thumb="${currentPage}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [currentPage])

  const pages = useMemo(
    () => Array.from({ length: tab.pageCount }, (_, index) => index + 1),
    [tab.pageCount]
  )

  if (!pdf) return <div className="p-3 text-sm text-muted-foreground">Loading…</div>

  return (
    <div ref={scrollRef} className="h-full overflow-auto p-1">
      {pages.map((pageNumber) => (
        <div key={pageNumber} data-thumb={pageNumber}>
          <Thumbnail
            pdf={pdf}
            pageNumber={pageNumber}
            isActive={pageNumber === currentPage}
            scrollRoot={scrollRoot}
            onSelect={requestScrollToPage}
          />
        </div>
      ))}
    </div>
  )
}
