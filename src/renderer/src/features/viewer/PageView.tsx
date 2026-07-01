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
import { renderPageToImageData } from '@/lib/pdfium'
import { getSource } from '@/store/documentStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { cn } from '@/lib/utils'
import type { Annotation } from '@/lib/annotations'
import type { CropBox } from '@/lib/pageModel'
import type { NewFormField } from '@/lib/formFields'
import type { PageLink } from '@/lib/links'
import { AnnotationLayer } from '@/features/annotations/AnnotationLayer'
import { ImageEditLayer } from '@/features/annotations/ImageEditLayer'
import { MeasureLayer } from '@/features/annotations/MeasureLayer'
import { FormLayer } from '@/features/forms/FormLayer'
import { FieldCreateLayer } from '@/features/forms/FieldCreateLayer'
import { LinkCreateLayer } from '@/features/annotations/LinkCreateLayer'
import { CropOverlay } from './CropOverlay'

/** Normalized render instruction for one logical page (built by the Viewer). */
export type RenderDescriptor =
  | {
      kind: 'source'
      pdf: PdfDocument
      sourceId: string
      pageIndex: number
      userRotation: number
      crop?: CropBox | null
    }
  | { kind: 'blank'; width: number; height: number; userRotation: number }

interface PageViewProps {
  descriptor: RenderDescriptor
  /** Logical 1-based page number within the document. */
  pageNumber: number
  scale: number
  scrollRoot: HTMLElement | null
  /** Natural (intrinsic-rotation, scale 1) size used to reserve layout space. */
  estimatedSize: PageSize
  onMeasured: (pageNumber: number, size: PageSize) => void
  highlightItems?: number[][] | undefined
  activeHighlightItems?: number[] | undefined
  /** Active document id + this page's stable key + annotations (for markup). */
  docId: string
  pageKey: string
  annotations: Annotation[]
  formFields: NewFormField[]
  links: PageLink[]
  /** Total logical page count, for internal link-target validation. */
  pageCount: number
}

interface HighlightRect {
  left: number
  top: number
  width: number
  height: number
}

const RENDERING_CANCELLED = 'RenderingCancelledException'

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
  descriptor,
  pageNumber,
  scale,
  scrollRoot,
  estimatedSize,
  onMeasured,
  highlightItems,
  activeHighlightItems,
  docId,
  pageKey,
  annotations,
  formFields,
  links,
  pageCount
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
  const [pageViewport, setPageViewport] = useState<PageViewport | null>(null)
  // The page's /UserUnit (default 1) — 1 user-space unit = userUnit/72 inch, so
  // the Measure tool needs it to report true physical lengths on large-format
  // (plotter) pages.
  const [pageUserUnit, setPageUserUnit] = useState(1)
  const [highlights, setHighlights] = useState<{
    normal: HighlightRect[]
    active: HighlightRect[]
  }>({ normal: [], active: [] })
  // Tier-3 PDFium (WASM) render backend, opt-in via preferences.
  const pdfiumEnabled = usePreferencesStore((s) => s.experimentalPdfiumRenderer)

  useEffect(() => {
    const element = wrapperRef.current
    if (!element || !scrollRoot) return
    // This observer only drives virtualization (whether to render the page's
    // canvas/text); current-page tracking is computed from real viewport
    // geometry in the Viewer so the inflated rootMargin can't skew it.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting)
      },
      { root: scrollRoot, rootMargin: '1200px 0px', threshold: 0 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [scrollRoot, pageNumber])

  useEffect(() => {
    if (descriptor.kind === 'blank') {
      onMeasured(pageNumber, { width: descriptor.width, height: descriptor.height })
      return
    }
    if (!visible) return
    const canvas = canvasRef.current
    const textContainer = textRef.current
    if (!canvas || !textContainer) return

    let cancelled = false
    const { pdf, pageIndex, userRotation, sourceId } = descriptor

    void (async () => {
      try {
        const page = await pdf.getPage(pageIndex + 1)
        if (cancelled) return
        pageRef.current = page

        const natural = page.getViewport({ scale: 1 })
        onMeasured(pageNumber, { width: natural.width, height: natural.height })

        // Compose the page's intrinsic rotation with the user-applied rotation.
        const rotation = normalizeRotation(page.rotate + userRotation)
        const viewport = page.getViewport({ scale, rotation })
        const dpr = window.devicePixelRatio || 1
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        // Tier-3: render the page bitmap with PDFium when enabled. PDFium honors
        // the page's intrinsic /Rotate, so it matches the viewport only when the
        // USER rotation is 0 — otherwise fall back to pdf.js. pdf.js still owns
        // the text layer + geometry below regardless of the bitmap source.
        const source = pdfiumEnabled ? getSource(sourceId) : undefined
        const usePdfium = !!source && normalizeRotation(userRotation) === 0
        // Both backends target the same floored device dimensions so the bitmap
        // aligns exactly with the CSS box and the viewport-derived overlays.
        const targetWidth = Math.floor(viewport.width * dpr)
        const targetHeight = Math.floor(viewport.height * dpr)
        let rendered = false
        if (usePdfium && source) {
          try {
            const image = await renderPageToImageData(
              sourceId,
              source.bytes,
              pageIndex,
              targetWidth,
              targetHeight
            )
            if (cancelled) return
            canvas.width = image.width
            canvas.height = image.height
            canvas.getContext('2d')?.putImageData(image, 0, 0)
            canvas.dataset.renderBackend = 'pdfium'
            rendered = true
          } catch (error) {
            // Never let a Tier-3 failure blank the page — degrade to pdf.js.
            console.warn(
              `[viewer] PDFium render failed on page ${pageNumber}, using pdf.js:`,
              error
            )
          }
        }
        if (!rendered) {
          canvas.width = targetWidth
          canvas.height = targetHeight
          renderTaskRef.current?.cancel()
          const renderParams: Parameters<PdfPage['render']>[0] = { canvas, viewport }
          if (dpr !== 1) renderParams.transform = [dpr, 0, 0, dpr, 0, 0]
          const task = page.render(renderParams)
          renderTaskRef.current = task
          await task.promise
          if (cancelled) return
          canvas.dataset.renderBackend = 'pdfjs'
        }

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
        setPageViewport(viewport)
        setPageUserUnit((page as { userUnit?: number }).userUnit ?? 1)
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
      // Don't let a blanked canvas keep advertising a stale render backend.
      delete canvas.dataset.renderBackend
      textContainer.replaceChildren()
      renderInfoRef.current = null
      setPageViewport(null)
      pageRef.current?.cleanup()
      pageRef.current = null
    }
  }, [visible, descriptor, scale, pageNumber, onMeasured, pdfiumEnabled])

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

  const rotated = normalizeRotation(descriptor.userRotation)
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
      {descriptor.kind === 'source' && pageViewport && (
        <>
          <FormLayer
            docId={docId}
            sourceId={descriptor.sourceId}
            pdf={descriptor.pdf}
            pageIndex={descriptor.pageIndex}
            viewport={pageViewport}
          />
          <AnnotationLayer
            docId={docId}
            pageKey={pageKey}
            viewport={pageViewport}
            annotations={annotations}
            pdf={descriptor.pdf}
            pageIndex={descriptor.pageIndex}
          />
          <ImageEditLayer
            docId={docId}
            pageKey={pageKey}
            viewport={pageViewport}
            pageIndex={descriptor.pageIndex}
          />
          <MeasureLayer
            docId={docId}
            pageKey={pageKey}
            viewport={pageViewport}
            userUnit={pageUserUnit}
          />
          {descriptor.crop && <CropOverlay viewport={pageViewport} crop={descriptor.crop} />}
          <FieldCreateLayer
            viewport={pageViewport}
            docId={docId}
            pageKey={pageKey}
            fields={formFields}
          />
          <LinkCreateLayer
            viewport={pageViewport}
            docId={docId}
            pageKey={pageKey}
            links={links}
            pageCount={pageCount}
          />
        </>
      )}
      {descriptor.kind === 'blank' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-neutral-300">
          Blank page
        </div>
      )}
    </div>
  )
}

export const PageView = memo(PageViewImpl)
