import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { getSource, type DocumentTab } from '@/store/documentStore'
import { useViewStore } from '@/store/viewStore'
import { useSelectionStore } from '@/store/selectionStore'
import { addRotation, type PageRef } from '@/lib/pageModel'
import { normalizeRotation } from '@/lib/geometry'
import type { PdfDocument, RenderTask } from '@/lib/pdf'
import { cn } from '@/lib/utils'
import { PageActions } from './PageActions'

const THUMB_WIDTH = 124

type ThumbDescriptor =
  | { kind: 'source'; pdf: PdfDocument; pageIndex: number; userRotation: number }
  | { kind: 'blank'; width: number; height: number; userRotation: number }

interface ThumbnailProps {
  descriptor: ThumbDescriptor
  pageNumber: number
  selected: boolean
  scrollRoot: HTMLElement | null
}

function ThumbnailImpl({
  descriptor,
  pageNumber,
  selected,
  scrollRoot
}: ThumbnailProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const observeRef = useRef<HTMLDivElement>(null)
  const taskRef = useRef<RenderTask | null>(null)
  const [visible, setVisible] = useState(false)
  const [size, setSize] = useState({ width: THUMB_WIDTH, height: THUMB_WIDTH * 1.294 })

  useEffect(() => {
    const element = observeRef.current
    if (!element || !scrollRoot) return
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => setVisible(entry.isIntersecting)),
      { root: scrollRoot, rootMargin: '500px 0px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    if (descriptor.kind === 'blank') {
      const swap = normalizeRotation(descriptor.userRotation) % 180 !== 0
      const w = swap ? descriptor.height : descriptor.width
      const h = swap ? descriptor.width : descriptor.height
      setSize({ width: THUMB_WIDTH, height: (THUMB_WIDTH / w) * h })
      return
    }
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const { pdf, pageIndex, userRotation } = descriptor
    void (async () => {
      try {
        const page = await pdf.getPage(pageIndex + 1)
        if (cancelled) return
        const rotation = normalizeRotation(page.rotate + userRotation)
        const base = page.getViewport({ scale: 1, rotation })
        const scale = THUMB_WIDTH / base.width
        const viewport = page.getViewport({ scale, rotation })
        setSize({ width: viewport.width, height: viewport.height })
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
  }, [visible, descriptor, pageNumber])

  return (
    <div ref={observeRef} className="flex flex-col items-center gap-1 p-1.5">
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden rounded-sm bg-white ring-1',
          selected ? 'ring-2 ring-primary' : 'ring-black/15'
        )}
        style={{ width: THUMB_WIDTH, height: size.height }}
      >
        {descriptor.kind === 'source' ? (
          <canvas ref={canvasRef} className="block" />
        ) : (
          <span className="text-[10px] text-neutral-300">blank</span>
        )}
      </div>
      <span
        className={cn('text-xs tabular-nums', selected ? 'font-medium' : 'text-muted-foreground')}
      >
        {pageNumber}
      </span>
    </div>
  )
}

const Thumbnail = memo(ThumbnailImpl)

/** Thumbnail rail with current-page sync, multi-select, and drag-to-reorder. */
export function Thumbnails({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const viewRotation = useViewStore((s) => s.rotation)
  const currentPage = useViewStore((s) => s.currentPage)
  const requestScrollToPage = useViewStore((s) => s.requestScrollToPage)
  const selected = useSelectionStore((s) => s.selected)
  const selectOnly = useSelectionStore((s) => s.selectOnly)
  const toggle = useSelectionStore((s) => s.toggle)
  const selectRange = useSelectionStore((s) => s.selectRange)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const selectedSet = useMemo(() => new Set(selected), [selected])

  useEffect(() => setScrollRoot(scrollRef.current), [])

  useEffect(() => {
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-thumb="${currentPage}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [currentPage])

  const descriptors = useMemo<(ThumbDescriptor | null)[]>(
    () =>
      tab.pages.map((ref: PageRef) => {
        const userRotation = addRotation(ref.rotation, viewRotation)
        if (ref.kind === 'blank') {
          return { kind: 'blank', width: ref.width, height: ref.height, userRotation }
        }
        const source = getSource(ref.sourceId)
        return source
          ? { kind: 'source', pdf: source.pdf, pageIndex: ref.sourceIndex, userRotation }
          : null
      }),
    [tab.pages, viewRotation]
  )

  const onThumbClick = (index: number, event: React.MouseEvent): void => {
    if (event.shiftKey) {
      selectRange(index)
    } else if (event.ctrlKey || event.metaKey) {
      toggle(index)
    } else {
      selectOnly(index)
      requestScrollToPage(index + 1)
    }
  }

  const onDrop = (index: number): void => {
    const moving = selectedSet.size > 0 ? selected : []
    if (moving.length > 0) {
      // Lazy import avoids a static cycle with the ops module.
      void import('@/lib/pageOps').then((ops) => ops.movePages(tab.id, moving, index))
    }
    setDropTarget(null)
  }

  return (
    <div className="flex h-full flex-col">
      <PageActions tab={tab} />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-1">
        {tab.pages.map((ref, index) => {
          const descriptor = descriptors[index]
          if (!descriptor) return <div key={ref.key} />
          return (
            <div
              key={ref.key}
              data-thumb={index + 1}
              draggable
              onClick={(event) => onThumbClick(index, event)}
              onDragStart={() => {
                if (!selectedSet.has(index)) selectOnly(index)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setDropTarget(index)
              }}
              onDrop={() => onDrop(index)}
              className={cn(
                'cursor-pointer rounded-md border-y-2 border-transparent',
                dropTarget === index && 'border-t-primary'
              )}
            >
              <Thumbnail
                descriptor={descriptor}
                pageNumber={index + 1}
                selected={selectedSet.has(index)}
                scrollRoot={scrollRoot}
              />
            </div>
          )
        })}
        {/* Drop zone for moving pages to the very end. */}
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDropTarget(tab.pages.length)
          }}
          onDrop={() => onDrop(tab.pages.length)}
          className={cn(
            'h-6 rounded border-t-2 border-transparent',
            dropTarget === tab.pages.length && 'border-t-primary'
          )}
        />
      </div>
    </div>
  )
}
