import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDocumentPdf, type DocumentTab } from '@/store/documentStore'
import { useViewStore } from '@/store/viewStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useSearchStore } from '@/store/searchStore'
import { fitPageScale, fitWidthScale, PAGE_GAP, PAGE_MARGIN, type PageSize } from '@/lib/geometry'
import type { ReadingMode } from '@shared/ipc'
import { PageView } from './PageView'
import './textLayer.css'

const DEFAULT_PAGE_SIZE: PageSize = { width: 612, height: 792 } // US Letter

const READING_FILTER: Record<ReadingMode, string> = {
  normal: 'none',
  sepia: 'sepia(0.5) brightness(1.02) contrast(0.96)',
  night: 'invert(1) hue-rotate(180deg)'
}

export function Viewer({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const pdf = getDocumentPdf(tab.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [estimatedSize, setEstimatedSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [sizes, setSizes] = useState<Map<number, PageSize>>(new Map())

  const zoomMode = useViewStore((s) => s.zoomMode)
  const scale = useViewStore((s) => s.scale)
  const rotation = useViewStore((s) => s.rotation)
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
  // Group match item-index arrays by page (rebuilt only when matches change), so
  // a page's highlight props stay referentially stable across next/prev.
  const matchItemsByPage = useMemo(() => {
    const map = new Map<number, number[][]>()
    for (const match of matches) {
      const existing = map.get(match.page)
      if (existing) existing.push(match.itemIndices)
      else map.set(match.page, [match.itemIndices])
    }
    return map
  }, [matches])

  const ratiosRef = useRef<Map<number, number>>(new Map())
  const rafRef = useRef<number | null>(null)

  // Capture the scroll element and observe its size for fit calculations.
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

  // Fetch page 1's natural size up front so layout space is reserved accurately.
  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    void pdf.getPage(1).then((page) => {
      if (cancelled) return
      const v = page.getViewport({ scale: 1 })
      setEstimatedSize({ width: v.width, height: v.height })
    })
    return () => {
      cancelled = true
    }
  }, [pdf])

  // Recompute fit scale when in a fit mode and inputs change.
  useEffect(() => {
    if (zoomMode === 'custom' || containerSize.width === 0) return
    const columns = layout === 'two-up' ? 2 : 1
    const next =
      zoomMode === 'fit-page'
        ? fitPageScale(estimatedSize, rotation, containerSize.width, containerSize.height)
        : fitWidthScale(estimatedSize, rotation, containerSize.width, columns)
    applyFitScale(next)
  }, [zoomMode, rotation, estimatedSize, containerSize, layout, applyFitScale])

  // Ctrl+wheel to zoom (like a desktop reader).
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

  // Determine the most-visible page (rAF-debounced) and update currentPage.
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
        // Only track pages that differ from the estimate, so uniform documents
        // never trigger per-page re-renders while scrolling.
        if (isDefault) {
          if (!current) return prev
          const next = new Map(prev)
          next.delete(pageNumber)
          return next
        }
        if (current && current.width === size.width && current.height === size.height) {
          return prev
        }
        const next = new Map(prev)
        next.set(pageNumber, size)
        return next
      })
    },
    [estimatedSize]
  )

  // Honour "jump to page" requests from the toolbar/keyboard.
  useEffect(() => {
    if (pendingScrollPage === null) return
    const element = scrollRef.current?.querySelector<HTMLElement>(
      `[data-page-number="${pendingScrollPage}"]`
    )
    element?.scrollIntoView({ block: 'start', behavior: 'auto' })
    clearPendingScroll()
  }, [pendingScrollPage, clearPendingScroll, layout])

  const sizeFor = useCallback(
    (pageNumber: number): PageSize => sizes.get(pageNumber) ?? estimatedSize,
    [sizes, estimatedSize]
  )

  const pageNumbers = useMemo(
    () => Array.from({ length: tab.pageCount }, (_, index) => index + 1),
    [tab.pageCount]
  )

  if (!pdf) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>
    )
  }

  const renderPage = (pageNumber: number): React.JSX.Element => (
    <PageView
      key={pageNumber}
      pdf={pdf}
      pageNumber={pageNumber}
      scale={scale}
      rotation={rotation}
      scrollRoot={scrollRoot}
      estimatedSize={sizeFor(pageNumber)}
      onVisibility={handleVisibility}
      onMeasured={handleMeasured}
      highlightItems={matchItemsByPage.get(pageNumber)}
      activeHighlightItems={activeMatch?.page === pageNumber ? activeMatch.itemIndices : undefined}
    />
  )

  let content: React.JSX.Element
  if (layout === 'single') {
    // Subscribes to currentPage in isolation so paging doesn't re-render the
    // whole viewer.
    content = (
      <div className="flex justify-center">
        <SinglePage pageCount={tab.pageCount} renderPage={renderPage} />
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
