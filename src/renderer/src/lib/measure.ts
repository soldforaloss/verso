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

/** Real-world units offered when calibrating a drawing scale. */
export const CALIBRATION_UNITS = ['ft', 'm', 'in', 'cm', 'mm', 'km', 'mi'] as const
export type CalibrationUnit = (typeof CALIBRATION_UNITS)[number]

/**
 * A drawing scale set by the user: a segment of `paperPoints` (PDF points, after
 * any /UserUnit scaling) represents `realValue` `realUnit` in the real world —
 * e.g. blueprints at 1/4" = 1'.
 */
export interface MeasureCalibration {
  paperPoints: number
  realValue: number
  realUnit: CalibrationUnit
}

/** Scaled real-world label for a paper length, e.g. `12.00 ft`. */
export function calibratedLabel(points: number, cal: MeasureCalibration): string {
  const value = (points / cal.paperPoints) * cal.realValue
  return `${value.toFixed(2)} ${cal.realUnit}`
}

/** Label for a paper length: calibrated real-world if a scale is set, else physical. */
export function measureLabel(
  points: number,
  unit: MeasureUnit,
  cal: MeasureCalibration | null
): string {
  return cal ? calibratedLabel(points, cal) : formatMeasurement(points, unit)
}

/** Short description of the active scale, e.g. `1.00 in = 4 ft`. */
export function calibrationSummary(cal: MeasureCalibration): string {
  return `${(cal.paperPoints / 72).toFixed(2)} in = ${cal.realValue} ${cal.realUnit}`
}
