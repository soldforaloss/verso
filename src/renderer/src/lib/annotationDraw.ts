import { degrees, rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Annotation, Point } from '@/lib/annotations'

function hexToRgb(hex: string): Color {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.replace(/(.)/g, '$1$1') : value
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  return rgb(Number.isFinite(r) ? r : 0, Number.isFinite(g) ? g : 0, Number.isFinite(b) ? b : 0)
}

/**
 * Draws an annotation into a PDF page's content stream (page space, bottom-left
 * origin — the same space annotations are stored in). Called during save to
 * flatten annotations so they persist and render identically everywhere.
 */
export function drawAnnotation(page: PDFPage, font: PDFFont, annotation: Annotation): void {
  const color = hexToRgb(annotation.color)

  switch (annotation.type) {
    case 'ink': {
      for (const stroke of annotation.strokes) {
        for (let i = 1; i < stroke.length; i += 1) {
          page.drawLine({
            start: stroke[i - 1]!,
            end: stroke[i]!,
            thickness: annotation.strokeWidth,
            color,
            opacity: annotation.opacity,
            lineCap: 1
          })
        }
      }
      break
    }
    case 'rect': {
      const { x, y, width, height } = annotation.rect
      page.drawRectangle({
        x,
        y,
        width,
        height,
        borderColor: color,
        borderWidth: annotation.strokeWidth,
        borderOpacity: annotation.opacity,
        ...(annotation.filled ? { color, opacity: 0.25 } : {})
      })
      break
    }
    case 'ellipse': {
      const { x, y, width, height } = annotation.rect
      page.drawEllipse({
        x: x + width / 2,
        y: y + height / 2,
        xScale: width / 2,
        yScale: height / 2,
        borderColor: color,
        borderWidth: annotation.strokeWidth,
        borderOpacity: annotation.opacity,
        ...(annotation.filled ? { color, opacity: 0.25 } : {})
      })
      break
    }
    case 'line': {
      page.drawLine({
        start: annotation.a,
        end: annotation.b,
        thickness: annotation.strokeWidth,
        color,
        opacity: annotation.opacity,
        lineCap: 1
      })
      if (annotation.arrow) {
        for (const head of arrowHeads(annotation.a, annotation.b)) {
          page.drawLine({
            start: annotation.b,
            end: head,
            thickness: annotation.strokeWidth,
            color,
            lineCap: 1
          })
        }
      }
      break
    }
    case 'text': {
      const { x, y, height } = annotation.rect
      page.drawText(annotation.text, {
        x,
        y: y + height - annotation.fontSize,
        size: annotation.fontSize,
        font,
        color,
        lineHeight: annotation.fontSize * 1.2,
        maxWidth: annotation.rect.width
      })
      break
    }
    case 'note': {
      // A small filled marker (the comment text lives in the app's panel).
      page.drawRectangle({
        x: annotation.point.x,
        y: annotation.point.y - 12,
        width: 12,
        height: 12,
        color,
        opacity: 0.9
      })
      break
    }
    case 'markup': {
      for (const quad of annotation.quads) {
        if (annotation.markup === 'highlight') {
          page.drawRectangle({
            x: quad.x,
            y: quad.y,
            width: quad.width,
            height: quad.height,
            color,
            opacity: annotation.opacity
          })
        } else {
          const y = annotation.markup === 'strike' ? quad.y + quad.height / 2 : quad.y + 1
          page.drawLine({
            start: { x: quad.x, y },
            end: { x: quad.x + quad.width, y },
            thickness: 1.5,
            color
          })
        }
      }
      break
    }
  }
}

function arrowHeads(from: Point, to: Point, size = 10): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const spread = Math.PI / 7
  return [
    { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) },
    { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) }
  ]
}

export { degrees }
