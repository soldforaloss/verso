/** A point in PDF page space (points, origin bottom-left, unrotated). */
export interface Point {
  x: number
  y: number
}

/** A rectangle in PDF page space. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type MarkupKind = 'highlight' | 'underline' | 'strike' | 'squiggly'

interface BaseAnnotation {
  id: string
  /** Stable key of the logical page this annotation belongs to. */
  pageKey: string
  /** Hex color, e.g. "#e23b3b". */
  color: string
  opacity: number
}

export type Annotation =
  | (BaseAnnotation & { type: 'ink'; strokeWidth: number; strokes: Point[][] })
  | (BaseAnnotation & { type: 'rect'; rect: Rect; strokeWidth: number; filled: boolean })
  | (BaseAnnotation & { type: 'ellipse'; rect: Rect; strokeWidth: number; filled: boolean })
  | (BaseAnnotation & { type: 'line'; a: Point; b: Point; strokeWidth: number; arrow: boolean })
  | (BaseAnnotation & { type: 'text'; rect: Rect; text: string; fontSize: number })
  | (BaseAnnotation & { type: 'note'; point: Point; text: string })
  | (BaseAnnotation & { type: 'markup'; markup: MarkupKind; quads: Rect[] })
  | (BaseAnnotation & { type: 'image'; rect: Rect; dataUrl: string })

export type AnnotationType = Annotation['type']

/** Tool palette colors. */
export const ANNOTATION_COLORS = [
  '#e23b3b',
  '#f59e0b',
  '#fde047',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#111827'
] as const

export function newAnnotationId(): string {
  return crypto.randomUUID()
}

function unionRect(rects: Rect[]): Rect {
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.width))
  const maxY = Math.max(...rects.map((r) => r.y + r.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Axis-aligned bounding rect of any annotation, in page space. */
export function boundsOf(annotation: Annotation): Rect {
  switch (annotation.type) {
    case 'rect':
    case 'ellipse':
    case 'text':
    case 'image':
      return annotation.rect
    case 'line':
      return {
        x: Math.min(annotation.a.x, annotation.b.x),
        y: Math.min(annotation.a.y, annotation.b.y),
        width: Math.abs(annotation.a.x - annotation.b.x),
        height: Math.abs(annotation.a.y - annotation.b.y)
      }
    case 'note':
      return { x: annotation.point.x, y: annotation.point.y, width: 18, height: 18 }
    case 'markup':
      return unionRect(annotation.quads)
    case 'ink': {
      const points = annotation.strokes.flat()
      if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
      return unionRect(points.map((p) => ({ x: p.x, y: p.y, width: 0, height: 0 })))
    }
  }
}

/** Returns a copy of the annotation translated by (dx, dy) in page space. */
export function translateAnnotation(annotation: Annotation, dx: number, dy: number): Annotation {
  const move = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy })
  const moveRect = (r: Rect): Rect => ({ ...r, x: r.x + dx, y: r.y + dy })
  switch (annotation.type) {
    case 'rect':
    case 'ellipse':
    case 'text':
    case 'image':
      return { ...annotation, rect: moveRect(annotation.rect) }
    case 'line':
      return { ...annotation, a: move(annotation.a), b: move(annotation.b) }
    case 'note':
      return { ...annotation, point: move(annotation.point) }
    case 'markup':
      return { ...annotation, quads: annotation.quads.map(moveRect) }
    case 'ink':
      return { ...annotation, strokes: annotation.strokes.map((s) => s.map(move)) }
  }
}
