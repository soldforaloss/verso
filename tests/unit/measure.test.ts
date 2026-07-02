import { describe, expect, it } from 'vitest'
import {
  calibratedLabel,
  calibrationSummary,
  distancePoints,
  formatMeasurement,
  measureLabel,
  pointsToUnit,
  type MeasureCalibration
} from '../../src/renderer/src/lib/measure'

describe('distancePoints', () => {
  it('is the Euclidean distance in page points', () => {
    expect(distancePoints({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(distancePoints({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0)
  })
})

describe('pointsToUnit', () => {
  it('treats 72 points as one physical inch', () => {
    expect(pointsToUnit(72, 'in')).toBeCloseTo(1, 6)
    expect(pointsToUnit(72, 'cm')).toBeCloseTo(2.54, 6)
    expect(pointsToUnit(72, 'mm')).toBeCloseTo(25.4, 6)
    expect(pointsToUnit(72, 'pt')).toBe(72)
  })
})

describe('formatMeasurement', () => {
  it('shows 2 decimals for physical units and none for points', () => {
    expect(formatMeasurement(72, 'in')).toBe('1.00 in')
    expect(formatMeasurement(36, 'in')).toBe('0.50 in')
    expect(formatMeasurement(72, 'cm')).toBe('2.54 cm')
    expect(formatMeasurement(180.4, 'pt')).toBe('180 pt')
  })
})

describe('calibration', () => {
  // 72pt on paper = 10 ft in the real world.
  const cal: MeasureCalibration = { paperPoints: 72, realValue: 10, realUnit: 'ft' }

  it('scales lengths proportionally to the calibration segment', () => {
    expect(calibratedLabel(72, cal)).toBe('10.00 ft')
    expect(calibratedLabel(144, cal)).toBe('20.00 ft')
    expect(calibratedLabel(36, cal)).toBe('5.00 ft')
  })

  it('measureLabel uses the calibration when set, else the physical unit', () => {
    expect(measureLabel(144, 'in', cal)).toBe('20.00 ft')
    expect(measureLabel(144, 'in', null)).toBe('2.00 in')
  })

  it('summarizes the scale in paper inches', () => {
    expect(calibrationSummary(cal)).toBe('1.00 in = 10 ft')
  })
})
