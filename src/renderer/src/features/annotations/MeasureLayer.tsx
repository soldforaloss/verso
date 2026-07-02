import { useRef, useState } from 'react'
import { useToolStore } from '@/store/toolStore'
import { addAnnotations } from '@/lib/annotationOps'
import { newAnnotationId, type Annotation, type Point } from '@/lib/annotations'
import { pageToScreen, screenToPage } from '@/lib/annotationGeometry'
import { distancePoints, measureLabel } from '@/lib/measure'
import { CalibrateDialog } from './CalibrateDialog'
import type { PageViewport } from '@/lib/pdf'

/** Distinct colour for measurement lines + labels. */
const MEASURE_COLOR = '#0369a1'
const LABEL_SIZE = 11
/** Ignore near-zero drags (an accidental click). */
const MIN_POINTS = 3

interface Props {
  docId: string
  pageKey: string
  viewport: PageViewport
  /** Page /UserUnit (default 1) — scales raw user-space points to true length. */
  userUnit: number
}

/**
 * The Measure tool: drag a line to measure a straight-line distance. A live
 * readout follows the cursor; on release the measurement is placed as a line
 * plus a text label (ordinary annotations, so they move, restyle, and flatten
 * on save). Lengths use the page's physical scale (PDF points = 1/72") in the
 * unit chosen in the toolbar — or, when a drawing scale has been calibrated
 * ("this distance = 10 ft"), real-world lengths at that scale.
 */
export function MeasureLayer({
  docId,
  pageKey,
  viewport,
  userUnit
}: Props): React.JSX.Element | null {
  const active = useToolStore((s) => s.tool === 'measure')
  const unit = useToolStore((s) => s.measureUnit)
  const calibration = useToolStore((s) => s.measureCalibrations[docId] ?? null)
  const calibrating = useToolStore((s) => s.measureCalibrating)
  const containerRef = useRef<HTMLDivElement>(null)
  const [start, setStart] = useState<Point | null>(null)
  const [end, setEnd] = useState<Point | null>(null)
  /** Paper length (points) of a just-dragged calibration segment awaiting input. */
  const [pendingCalibration, setPendingCalibration] = useState<number | null>(null)

  if (!active) return null

  /** Physical length (points) of a segment, honouring the page's /UserUnit. */
  const lengthPoints = (a: Point, b: Point): number => distancePoints(a, b) * userUnit

  const cancel = (): void => {
    setStart(null)
    setEnd(null)
  }

  const local = (event: React.PointerEvent): Point => {
    const rect = containerRef.current!.getBoundingClientRect()
    return screenToPage(viewport, event.clientX - rect.left, event.clientY - rect.top)
  }

  const onPointerDown = (event: React.PointerEvent): void => {
    // While the scale dialog is open, its (portaled) events bubble through the
    // React tree — don't start a drag or capture the pointer from them.
    if (pendingCalibration !== null) return
    event.preventDefault()
    const p = local(event)
    setStart(p)
    setEnd(p)
    containerRef.current?.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent): void => {
    if (!start) return
    setEnd(local(event))
  }

  const onPointerUp = (event: React.PointerEvent): void => {
    containerRef.current?.releasePointerCapture?.(event.pointerId)
    const a = start
    const b = end
    setStart(null)
    setEnd(null)
    if (!a || !b || distancePoints(a, b) < MIN_POINTS) return

    // Calibration mode: the drag defines the known distance — ask what it equals.
    if (calibrating) {
      setPendingCalibration(lengthPoints(a, b))
      return
    }

    const label = measureLabel(lengthPoints(a, b), unit, calibration)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const width = Math.max(24, label.length * LABEL_SIZE * 0.62)
    const height = LABEL_SIZE * 1.4
    const line: Annotation = {
      id: newAnnotationId(),
      pageKey,
      type: 'line',
      color: MEASURE_COLOR,
      opacity: 1,
      a,
      b,
      strokeWidth: 1.5,
      arrow: false
    }
    const text: Annotation = {
      id: newAnnotationId(),
      pageKey,
      type: 'text',
      color: MEASURE_COLOR,
      opacity: 1,
      text: label,
      fontSize: LABEL_SIZE,
      rect: { x: mid.x - width / 2, y: mid.y - height / 2, width, height }
    }
    addAnnotations(docId, [line, text], 'Measure')
  }

  const a = start ? pageToScreen(viewport, start) : null
  const b = end ? pageToScreen(viewport, end) : null
  const live =
    start && end
      ? calibrating
        ? 'Calibrating…'
        : measureLabel(lengthPoints(start, end), unit, calibration)
      : null

  return (
    <>
      <div
        ref={containerRef}
        data-measure-layer
        className="absolute inset-0"
        style={{ zIndex: 5, pointerEvents: 'auto', cursor: 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
      >
        {a && b && (
          <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={MEASURE_COLOR} strokeWidth={1.5} />
          </svg>
        )}
        {b && live && (
          <span
            data-measure-readout
            className="pointer-events-none absolute rounded bg-sky-800 px-1.5 py-0.5 text-xs text-white shadow"
            style={{ left: b.x + 12, top: b.y + 12 }}
          >
            {live}
          </span>
        )}
      </div>
      {/* Outside the pointer-handling container so its (React-tree-bubbling)
          events never reach the drag handlers. */}
      {pendingCalibration !== null && (
        <CalibrateDialog
          docId={docId}
          paperPoints={pendingCalibration}
          onClose={() => setPendingCalibration(null)}
        />
      )}
    </>
  )
}
