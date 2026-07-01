import type { Point } from '@/lib/annotations'

/** Physical length units a measurement can be shown in (PDF points are 1/72 in). */
export type MeasureUnit = 'in' | 'cm' | 'mm' | 'pt'

export const MEASURE_UNITS: MeasureUnit[] = ['in', 'cm', 'mm', 'pt']

/** Straight-line distance between two page-space points, in PDF points. */
export function distancePoints(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Converts a length in PDF points to the given physical unit. */
export function pointsToUnit(points: number, unit: MeasureUnit): number {
  switch (unit) {
    case 'in':
      return points / 72
    case 'cm':
      return (points / 72) * 2.54
    case 'mm':
      return (points / 72) * 25.4
    case 'pt':
      return points
  }
}

/** A human-readable measurement label, e.g. `2.50 in` or `180 pt`. */
export function formatMeasurement(points: number, unit: MeasureUnit): string {
  const value = pointsToUnit(points, unit)
  return `${value.toFixed(unit === 'pt' ? 0 : 2)} ${unit}`
}
