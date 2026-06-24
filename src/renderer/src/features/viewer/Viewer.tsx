import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSource, type DocumentTab } from '@/store/documentStore'
import { useViewStore } from '@/store/viewStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useSearchStore } from '@/store/searchStore'
import { fitPageScale, fitWidthScale, PAGE_GAP, PAGE_MARGIN, type PageSize } from '@/lib/geometry'
import { addRotation } from '@/lib/pageModel'
import type { ReadingMode } from '@shared/ipc'
import { PageView, type RenderDescriptor } from './PageView'
import './textLayer.css'

const DEFAULT_PAGE_SIZE: PageSize = { width: 612, height: 792 } // US Letter

const READING_FILTER: Record<ReadingMode, string> = {
  normal: 'none',
  sepia: 'sepia(0.5) brightness(1.02) contrast(0.96)',
  night: 'invert(1) hue-rotate(180deg)'
}

export function Viewer({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [estimatedSize, setEstimatedSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [sizes, setSizes] = useState<Map<number, PageSize>>(new Map())

  const zoomMode = useViewStore((s) => s.zoomMode)
  const scale = useViewStore((s) => s.scale)
  const viewRotation = useViewStore((s) => s.rotation)
  const pendingScrollPage = useViewStore((s) => s.pendingScrollPage)
  const applyFitScale = useViewStore((s) => s.applyFitScale)
  const zoomIn = useViewStore((s) => s.zoomIn)
  const zoomOut = useViewStore((s) => s.zoomOut)
  const setCurrentPage = useViewStore((s) => s.setCurrentPage)
  const clearPendingScroll = useViewStore((s) => s.clearPendingScroll)
  const layout = usePreferencesStore((s) => s.layout)
  const readingMode = usePreferencesStore((s) => s.readingMode)

  const matches = useSearchStore((s) => s.matches)
  const activeMatchIndex = useSearchStore((s) => s.activeIndex)
  const activeMatch = matches[activeMatchIndex]
  const matchItemsByPage = useMemo(() => {
    const map = new Map<number, number[][]>()
    for (const match of matches) {
      const existing = map.get(match.page)
      if (existing) existing.push(match.itemIndices)
      else map.set(match.page, [match.itemIndices])
    }
    return map
  }, [matches])

  const pages = tab.pages
  // Stable render descriptors: rebuilt only when the page model or view rotation
  // changes, so scrolling/search don't re-render every page.
  const descriptors = useMemo<(RenderDescriptor | null)[]>(
    () =>
      pages.map((ref) => {
        const userRotation = addRotation(ref.rotation, viewRotation)
        if (ref.kind === 'blank') {
          return { kind: 'blank', width: ref.width, height: ref.height, userRotation }
        }
        const source = getSource(ref.sourceId)
        return source
          ? { kind: 'source', pdf: source.pdf, pageIndex: ref.sourceIndex, userRotation }
          : null
      }),
    [pages, viewRotation]
  )

  const ratiosRef = useRef<Map<number, number>>(new Map())
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const element = scrollRef.current
    setScrollRoot(element)
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setContainerSize({ width: rect.width, height: rect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Estimate layout size from the first page so space is reserved accurately.
  useEffect(() => {
    const first = pages[0]
    if (!first) return
    if (first.kind === 'blank') {
      setEstimatedSize({ width: first.width, height: first.height })
      return
    }
    const source = getSource(first.sourceId)
    if (!source) return
    let cancelled = false
    void source.pdf.getPage(first.sourceIndex + 1).then((page) => {
      if (cancelled) return
      const v = page.getViewport({ scale: 1 })
      setEstimatedSize({ width: v.width, height: v.height })
    })
    return () => {
      cancelled = true
    }
  }, [pages])

  useEffect(() => {
    if (zoomMode === 'custom' || containerSize.width === 0) return
    const columns = layout === 'two-up' ? 2 : 1
    const next =
      zoomMode === 'fit-page'
        ? fitPageScale(estimatedSize, viewRotation, containerSize.width, containerSize.height)
        : fitWidthScale(estimatedSize, viewRotation, containerSize.width, columns)
    applyFitScale(next)
  }, [zoomMode, viewRotation, estimatedSize, containerSize, layout, applyFitScale])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey) return
      event.preventDefault()
      if (event.deltaY < 0) zoomIn()
      else zoomOut()
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [zoomIn, zoomOut])

  const handleVisibility = useCallback(
    (pageNumber: number, ratio: number) => {
      ratiosRef.current.set(pageNumber, ratio)
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        let best = -1
        let bestPage = 1
        for (const [page, value] of ratiosRef.current) {
          if (value > best) {
            best = value
            bestPage = page
          }
        }
        if (best > 0) setCurrentPage(bestPage)
      })
    },
    [setCurrentPage]
  )

  const handleMeasured = useCallback(
    (pageNumber: number, size: PageSize) => {
      setSizes((prev) => {
        const isDefault = size.width === estimatedSize.width && size.height === estimatedSize.height
        const current = prev.get(pageNumber)
        if (isDefault) {
          if (!current) return prev
          const next = new Map(prev)
          next.delete(pageNumber)
          return next
        }
        if (current && current.width === size.width && current.height === size.height) return prev
        const next = new Map(prev)
        next.set(pageNumber, size)
        return next
      })
    },
    [estimatedSize]
  )

  useEffect(() => {
    if (pendingScrollPage === null) return
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${pendingScrollPage}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'auto' })
    clearPendingScroll()
  }, [pendingScrollPage, clearPendingScroll, layout])

  const sizeFor = useCallback(
    (pageNumber: number): PageSize => sizes.get(pageNumber) ?? estimatedSize,
    [sizes, estimatedSize]
  )

  const pageNumbers = useMemo(() => pages.map((_, index) => index + 1), [pages])

  const renderPage = (pageNumber: number): React.JSX.Element => {
    const ref = pages[pageNumber - 1]
    const descriptor = descriptors[pageNumber - 1]
    if (!ref || !descriptor) return <div key={pageNumber} />
    const estimate =
      ref.kind === 'blank' ? { width: ref.width, height: ref.height } : sizeFor(pageNumber)
    return (
      <PageView
        key={ref.key}
        descriptor={descriptor}
        pageNumber={pageNumber}
        scale={scale}
        scrollRoot={scrollRoot}
        estimatedSize={estimate}
        onVisibility={handleVisibility}
        onMeasured={handleMeasured}
        highlightItems={matchItemsByPage.get(pageNumber)}
        activeHighlightItems={
          activeMatch?.page === pageNumber ? activeMatch.itemIndices : undefined
        }
      />
    )
  }

  let content: React.JSX.Element
  if (pages.length === 0) {
    content = <div className="text-sm text-muted-foreground">This document has no pages.</div>
  } else if (layout === 'single') {
    content = (
      <div className="flex justify-center">
        <SinglePage pageCount={pages.length} renderPage={renderPage} />
      </div>
    )
  } else if (layout === 'two-up') {
    const rows: number[][] = []
    for (let index = 0; index < pageNumbers.length; index += 2) {
      rows.push(pageNumbers.slice(index, index + 2))
    }
    content = (
      <div className="flex flex-col items-center" style={{ gap: PAGE_GAP }}>
        {rows.map((row) => (
          <div key={row[0]} className="flex" style={{ gap: PAGE_GAP }}>
            {row.map(renderPage)}
          </div>
        ))}
      </div>
    )
  } else {
    content = (
      <div className="flex flex-col items-center" style={{ gap: PAGE_GAP }}>
        {pageNumbers.map(renderPage)}
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto bg-neutral-200 dark:bg-neutral-900"
      style={{ padding: PAGE_MARGIN }}
      data-testid="viewer-scroll"
    >
      <div style={{ filter: READING_FILTER[readingMode] }}>{content}</div>
    </div>
  )
}

/** Single-page layout: renders just the current page. */
function SinglePage({
  pageCount,
  renderPage
}: {
  pageCount: number
  renderPage: (pageNumber: number) => React.JSX.Element
}): React.JSX.Element {
  const currentPage = useViewStore((s) => s.currentPage)
  return renderPage(Math.min(Math.max(1, currentPage), pageCount))
}
