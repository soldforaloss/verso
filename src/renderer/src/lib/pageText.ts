import { newAnnotationId, type Annotation } from '@/lib/annotations'
import { addAnnotationsAcrossPages } from '@/lib/annotationOps'
import { getSource, type DocumentTab } from '@/store/documentStore'
import type { PageRef } from '@/lib/pageModel'

const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
const measureCtx = measureCanvas?.getContext('2d') ?? null

function measureWidth(text: string, fontSize: number): number {
  if (!measureCtx) return text.length * fontSize * 0.5
  measureCtx.font = `${fontSize}px sans-serif`
  return measureCtx.measureText(text).width
}

/** Unrotated page size (PDF points) — the space annotations are drawn into. */
async function logicalPageSize(ref: PageRef): Promise<{ width: number; height: number } | null> {
  if (ref.kind === 'blank') return { width: ref.width, height: ref.height }
  const source = getSource(ref.sourceId)
  if (!source) return null
  const page = await source.pdf.getPage(ref.sourceIndex + 1)
  const viewport = page.getViewport({ scale: 1, rotation: 0 })
  return { width: viewport.width, height: viewport.height }
}

export interface WatermarkOptions {
  text: string
  opacity: number
  fontSize: number
  color: string
}

/** Stamps a centered text watermark onto every page (one undoable command). */
export async function addWatermark(tab: DocumentTab, options: WatermarkOptions): Promise<void> {
  const text = options.text.trim()
  if (!text) return
  const textWidth = measureWidth(text, options.fontSize)
  const byPageKey: Record<string, Annotation[]> = {}
  for (const ref of tab.pages) {
    const size = await logicalPageSize(ref)
    if (!size) continue
    byPageKey[ref.key] = [
      {
        id: newAnnotationId(),
        pageKey: ref.key,
        type: 'text',
        color: options.color,
        opacity: options.opacity,
        fontSize: options.fontSize,
        text,
        rect: {
          x: Math.max(8, (size.width - textWidth) / 2),
          y: (size.height - options.fontSize) / 2,
          width: Math.min(textWidth + 8, size.width),
          height: options.fontSize * 1.4
        }
      }
    ]
  }
  addAnnotationsAcrossPages(tab.id, byPageKey, 'Add watermark')
}

export type PageNumberPosition = 'bottom-center' | 'bottom-right' | 'top-right'

export interface PageNumberOptions {
  start: number
  fontSize: number
  position: PageNumberPosition
  color: string
}

/** Adds a running page number to every page (one undoable command). */
export async function addPageNumbers(tab: DocumentTab, options: PageNumberOptions): Promise<void> {
  const margin = 28
  const byPageKey: Record<string, Annotation[]> = {}
  for (let i = 0; i < tab.pages.length; i += 1) {
    const ref = tab.pages[i]!
    const size = await logicalPageSize(ref)
    if (!size) continue
    const label = String(options.start + i)
    const width = measureWidth(label, options.fontSize)
    const x =
      options.position === 'bottom-center' ? (size.width - width) / 2 : size.width - margin - width
    const y = options.position === 'top-right' ? size.height - margin : margin
    byPageKey[ref.key] = [
      {
        id: newAnnotationId(),
        pageKey: ref.key,
        type: 'text',
        color: options.color,
        opacity: 1,
        fontSize: options.fontSize,
        text: label,
        rect: { x, y, width: width + 4, height: options.fontSize * 1.4 }
      }
    ]
  }
  addAnnotationsAcrossPages(tab.id, byPageKey, 'Add page numbers')
}
