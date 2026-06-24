import type { PageViewport } from '@/lib/pdf'
import type { Point, Rect } from '@/lib/annotations'

/** Screen point (CSS px relative to the page, top-left origin). */
export interface ScreenPoint {
  x: number
  y: number
}

export function pageToScreen(viewport: PageViewport, point: Point): ScreenPoint {
  const [x, y] = viewport.convertToViewportPoint(point.x, point.y)
  return { x, y }
}

export function screenToPage(viewport: PageViewport, x: number, y: number): Point {
  const [px, py] = viewport.convertToPdfPoint(x, y)
  return { x: px, y: py }
}

/** Converts a page-space rect to a normalized screen-space rect. */
export function pageRectToScreen(viewport: PageViewport, rect: Rect): Rect {
  const a = pageToScreen(viewport, { x: rect.x, y: rect.y })
  const b = pageToScreen(viewport, { x: rect.x + rect.width, y: rect.y + rect.height })
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

/** Normalizes a (possibly negative-extent) rect to positive width/height. */
export function normalizeRect(rect: Rect): Rect {
  return {
    x: rect.width < 0 ? rect.x + rect.width : rect.x,
    y: rect.height < 0 ? rect.y + rect.height : rect.y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height)
  }
}

/** Builds an SVG path (screen coords) for ink strokes. */
export function inkToScreenPath(viewport: PageViewport, strokes: Point[][]): string {
  return strokes
    .map((stroke) =>
      stroke
        .map((point, index) => {
          const s = pageToScreen(viewport, point)
          return `${index === 0 ? 'M' : 'L'} ${s.x.toFixed(2)} ${s.y.toFixed(2)}`
        })
        .join(' ')
    )
    .join(' ')
}

/** Two short segments forming an arrowhead at `to` (screen coords). */
export function arrowHead(
  from: ScreenPoint,
  to: ScreenPoint,
  size = 12
): [ScreenPoint, ScreenPoint] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const spread = Math.PI / 7
  return [
    { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) },
    { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) }
  ]
}
