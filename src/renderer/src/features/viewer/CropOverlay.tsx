import type { PageViewport } from '@/lib/pdf'
import type { CropBox } from '@/lib/pageModel'
import { pageRectToScreen } from '@/lib/annotationGeometry'

/**
 * Dims the margins that a page crop will remove, outlining the kept region, so
 * the crop is visible in the viewer (it is applied losslessly via setCropBox on
 * save). Non-interactive; reuses the page→screen mapping (rotation/scale-aware),
 * so it doesn't touch page sizing or current-page tracking.
 */
export function CropOverlay({
  viewport,
  crop
}: {
  viewport: PageViewport
  crop: CropBox
}): React.JSX.Element {
  const kept = pageRectToScreen(viewport, crop)
  const width = viewport.width
  const height = viewport.height
  const left = Math.max(0, Math.min(width, kept.x))
  const top = Math.max(0, Math.min(height, kept.y))
  const right = Math.max(left, Math.min(width, kept.x + kept.width))
  const bottom = Math.max(top, Math.min(height, kept.y + kept.height))

  const mask = 'absolute bg-black/45'
  return (
    <div
      data-testid="crop-overlay"
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 2 }}
    >
      <div className={mask} style={{ left: 0, top: 0, width, height: top }} />
      <div className={mask} style={{ left: 0, top: bottom, width, height: height - bottom }} />
      <div className={mask} style={{ left: 0, top, width: left, height: bottom - top }} />
      <div
        className={mask}
        style={{ left: right, top, width: width - right, height: bottom - top }}
      />
      <div
        className="absolute border border-dashed border-primary/80"
        style={{ left, top, width: right - left, height: bottom - top }}
      />
    </div>
  )
}
