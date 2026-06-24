import { memo, useEffect, useRef, useState } from 'react'
import { TextLayer, type PdfDocument, type PdfPage, type RenderTask } from '@/lib/pdf'
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
}

const RENDERING_CANCELLED = 'RenderingCancelledException'

/**
 * Renders a single PDF page to a canvas with an aligned, selectable text layer.
 *
 * Rendering is lazy: a page only paints when it (or its 1200px prefetch margin)
 * enters the scroll viewport, and its canvas/text are released when it scrolls
 * far away. This keeps memory bounded for very large documents while preserving
 * smooth scrolling. Until painted, the wrapper reserves space using the
 * estimated page size.
 */
function PageViewImpl({
  pdf,
  pageNumber,
  scale,
  rotation,
  scrollRoot,
  estimatedSize,
  onVisibility,
  onMeasured
}: PageViewProps): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const pageRef = useRef<PdfPage | null>(null)
  const [visible, setVisible] = useState(false)

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

        // Selectable/copyable text overlay aligned to the canvas.
        textContainer.replaceChildren()
        textContainer.style.width = `${Math.floor(viewport.width)}px`
        textContainer.style.height = `${Math.floor(viewport.height)}px`
        textContainer.style.setProperty('--total-scale-factor', String(viewport.scale))
        const textLayer = new TextLayer({
          textContentSource: await page.getTextContent(),
          container: textContainer,
          viewport
        })
        await textLayer.render()
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
      // Free GPU/CPU memory for off-screen pages (use the captured nodes).
      canvas.width = 0
      canvas.height = 0
      textContainer.replaceChildren()
      pageRef.current?.cleanup()
      pageRef.current = null
    }
  }, [visible, pdf, pageNumber, scale, rotation, onMeasured])

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
