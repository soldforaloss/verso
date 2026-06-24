import { memo, useEffect, useRef, useState } from 'react'
import { Util } from 'pdfjs-dist'
import {
  TextLayer,
  type PageViewport,
  type PdfDocument,
  type PdfPage,
  type RenderTask,
  type TextContentItem
} from '@/lib/pdf'
import { normalizeRotation, type PageSize } from '@/lib/geometry'
import { cn } from '@/lib/utils'

interface PageViewProps {
  pdf: PdfDocument
  pageNumber: number
  scale: number
  rotation: number
  /** Scroll container used as the IntersectionObserver root. */
  scrollRoot: HTMLElement | null
  /** Natural (scale 1, no user rotation) size used to reserve layout space. */
  estimatedSize: PageSize
  onVisibility: (pageNumber: number, ratio: number) => void
  onMeasured: (pageNumber: number, size: PageSize) => void
  /** Search matches on this page, each as the item indices it spans. */
  highlightItems?: number[][] | undefined
  /** The currently-active search match's item indices, if it is on this page. */
  activeHighlightItems?: number[] | undefined
}

interface HighlightRect {
  left: number
  top: number
  width: number
  height: number
}

const RENDERING_CANCELLED = 'RenderingCancelledException'

/** Rectangles (in canvas CSS px) for the given text items at the viewport. */
function rectsFor(
  itemIndices: number[],
  items: readonly TextContentItem[],
  viewport: PageViewport
): HighlightRect[] {
  const rects: HighlightRect[] = []
  for (const index of itemIndices) {
    const item = items[index]
    if (!item || !('transform' in item)) continue
    const m = Util.transform(viewport.transform, item.transform)
    const height = Math.hypot(m[2], m[3])
    rects.push({ left: m[4], top: m[5] - height, width: item.width * viewport.scale, height })
  }
  return rects
}

function PageViewImpl({
  pdf,
  pageNumber,
  scale,
  rotation,
  scrollRoot,
  estimatedSize,
  onVisibility,
  onMeasured,
  highlightItems,
  activeHighlightItems
}: PageViewProps): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const pageRef = useRef<PdfPage | null>(null)
  const renderInfoRef = useRef<{
    viewport: PageViewport
    items: readonly TextContentItem[]
  } | null>(null)
  const [visible, setVisible] = useState(false)
  const [renderTick, setRenderTick] = useState(0)
  const [highlights, setHighlights] = useState<{
    normal: HighlightRect[]
    active: HighlightRect[]
  }>({ normal: [], active: [] })

  // Track viewport visibility (+ prefetch margin) to drive lazy rendering and
  // current-page detection.
  useEffect(() => {
    const element = wrapperRef.current
    if (!element || !scrollRoot) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setVisible(entry.isIntersecting)
          onVisibility(pageNumber, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
      },
      { root: scrollRoot, rootMargin: '1200px 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [scrollRoot, pageNumber, onVisibility])

  // Paint the page (canvas + text layer) while visible; release it otherwise.
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    const textContainer = textRef.current
    if (!canvas || !textContainer) return

    let cancelled = false

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        pageRef.current = page

        const natural = page.getViewport({ scale: 1 })
        onMeasured(pageNumber, { width: natural.width, height: natural.height })

        const viewport = page.getViewport({ scale, rotation })
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        renderTaskRef.current?.cancel()
        const renderParams: Parameters<PdfPage['render']>[0] = { canvas, viewport }
        if (dpr !== 1) renderParams.transform = [dpr, 0, 0, dpr, 0, 0]
        const task = page.render(renderParams)
        renderTaskRef.current = task
        await task.promise
        if (cancelled) return

        const textContent = await page.getTextContent()
        textContainer.replaceChildren()
        textContainer.style.width = `${Math.floor(viewport.width)}px`
        textContainer.style.height = `${Math.floor(viewport.height)}px`
        textContainer.style.setProperty('--total-scale-factor', String(viewport.scale))
        const textLayer = new TextLayer({
          textContentSource: textContent,
          container: textContainer,
          viewport
        })
        await textLayer.render()

        renderInfoRef.current = { viewport, items: textContent.items }
        setRenderTick((tick) => tick + 1)
      } catch (error) {
        if (!(error instanceof Error) || error.name !== RENDERING_CANCELLED) {
          console.error(`[viewer] failed to render page ${pageNumber}:`, error)
        }
      }
    })()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
      canvas.width = 0
      canvas.height = 0
      textContainer.replaceChildren()
      renderInfoRef.current = null
      pageRef.current?.cleanup()
      pageRef.current = null
    }
  }, [visible, pdf, pageNumber, scale, rotation, onMeasured])

  // Recompute search-highlight rectangles when matches or the rendered viewport change.
  useEffect(() => {
    const info = renderInfoRef.current
    if (!info || (!highlightItems && !activeHighlightItems)) {
      setHighlights({ normal: [], active: [] })
      return
    }
    const normal = (highlightItems ?? []).flatMap((items) =>
      rectsFor(items, info.items, info.viewport)
    )
    const active = activeHighlightItems
      ? rectsFor(activeHighlightItems, info.items, info.viewport)
      : []
    setHighlights({ normal, active })
  }, [highlightItems, activeHighlightItems, renderTick])

  const rotated = normalizeRotation(rotation)
  const swap = rotated === 90 || rotated === 270
  const cssWidth = (swap ? estimatedSize.height : estimatedSize.width) * scale
  const cssHeight = (swap ? estimatedSize.width : estimatedSize.height) * scale

  return (
    <div
      ref={wrapperRef}
      data-page-number={pageNumber}
      className={cn('relative shrink-0 bg-white shadow-md ring-1 ring-black/10')}
      style={{ width: cssWidth, height: cssHeight }}
    >
      <canvas ref={canvasRef} className="block" />
      {(highlights.normal.length > 0 || highlights.active.length > 0) && (
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 1 }}>
          {highlights.normal.map((rect, index) => (
            <div
              key={`n${index}`}
              className="absolute"
              style={{ ...rect, background: 'rgba(255, 213, 0, 0.4)' }}
            />
          ))}
          {highlights.active.map((rect, index) => (
            <div
              key={`a${index}`}
              className="absolute"
              style={{
                ...rect,
                background: 'rgba(255, 138, 0, 0.55)',
                outline: '1.5px solid rgba(229, 110, 0, 0.95)'
              }}
            />
          ))}
        </div>
      )}
      <div ref={textRef} className="textLayer" />
      {!visible && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
          {pageNumber}
        </div>
      )}
    </div>
  )
}

/**
 * Memoized so routine scrolling (which only updates the parent's current-page
 * state) does not re-render every page in a large document.
 */
export const PageView = memo(PageViewImpl)
