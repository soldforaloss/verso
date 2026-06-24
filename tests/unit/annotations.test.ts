import { describe, it, expect } from 'vitest'
import { boundsOf, translateAnnotation, type Annotation } from '@/lib/annotations'

const base = { id: 'a', pageKey: 'p', color: '#000000', opacity: 1 }

describe('annotation geometry', () => {
  describe('boundsOf', () => {
    it('bounds an ink annotation', () => {
      const ink: Annotation = {
        ...base,
        type: 'ink',
        strokeWidth: 2,
        strokes: [
          [
            { x: 10, y: 10 },
            { x: 30, y: 50 }
          ]
        ]
      }
      expect(boundsOf(ink)).toEqual({ x: 10, y: 10, width: 20, height: 40 })
    })

    it('bounds a line', () => {
      const line: Annotation = {
        ...base,
        type: 'line',
        strokeWidth: 1,
        arrow: false,
        a: { x: 5, y: 40 },
        b: { x: 35, y: 10 }
      }
      expect(boundsOf(line)).toEqual({ x: 5, y: 10, width: 30, height: 30 })
    })

    it('unions markup quads', () => {
      const markup: Annotation = {
        ...base,
        type: 'markup',
        markup: 'highlight',
        quads: [
          { x: 5, y: 5, width: 10, height: 2 },
          { x: 5, y: 9, width: 20, height: 2 }
        ]
      }
      expect(boundsOf(markup)).toEqual({ x: 5, y: 5, width: 20, height: 6 })
    })
  })

  describe('translateAnnotation', () => {
    it('translates a rectangle', () => {
      const rect: Annotation = {
        ...base,
        type: 'rect',
        strokeWidth: 1,
        filled: false,
        rect: { x: 0, y: 0, width: 100, height: 50 }
      }
      const moved = translateAnnotation(rect, 10, -5)
      expect(moved.type === 'rect' && moved.rect).toEqual({ x: 10, y: -5, width: 100, height: 50 })
    })

    it('translates every ink point', () => {
      const ink: Annotation = {
        ...base,
        type: 'ink',
        strokeWidth: 2,
        strokes: [[{ x: 0, y: 0 }]]
      }
      const moved = translateAnnotation(ink, 5, 7)
      expect(moved.type === 'ink' && moved.strokes[0]?.[0]).toEqual({ x: 5, y: 7 })
    })
  })
})
