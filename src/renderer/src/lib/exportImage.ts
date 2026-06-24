import { loadPdfDocument } from '@/lib/pdf'
import { buildDocumentPdf } from '@/lib/save'
import type { DocumentTab } from '@/store/documentStore'

export type ImageFormat = 'png' | 'jpeg'

export interface ExportImageOptions {
  format: ImageFormat
  /** Render scale (1 = 72dpi, 2 = 144dpi, …). */
  scale: number
  /** 1-based logical page numbers to export. */
  pages: number[]
}

const EXT: Record<ImageFormat, string> = { png: 'png', jpeg: 'jpg' }
const MIME: Record<ImageFormat, string> = { png: 'image/png', jpeg: 'image/jpeg' }

function stripPdfExt(name: string): string {
  return name.replace(/\.pdf$/i, '')
}

/** Builds the output file name for a single page (exported for testing). */
export function imageFileName(docName: string, pageNumber: number, format: ImageFormat): string {
  return `${stripPdfExt(docName)}-p${String(pageNumber).padStart(3, '0')}.${EXT[format]}`
}

async function canvasToBytes(
  canvas: HTMLCanvasElement,
  format: ImageFormat
): Promise<Uint8Array<ArrayBuffer>> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), MIME[format], format === 'jpeg' ? 0.92 : undefined)
  )
  if (!blob) throw new Error('Failed to encode image.')
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Renders the materialized (flattened) document and exports the requested pages
 * as PNG/JPEG images. Rendering the built PDF — rather than the live source —
 * means annotations, filled forms, and rotations are baked into the output, so
 * the export is exactly what the viewer shows.
 *
 * A single page prompts for a file path; multiple pages prompt for a folder.
 * Returns the number of images written (0 if the user cancels).
 */
export async function exportPagesToImages(
  tab: DocumentTab,
  options: ExportImageOptions
): Promise<number> {
  const pageNumbers = options.pages.filter((n) => n >= 1 && n <= tab.pages.length)
  if (pageNumbers.length === 0) return 0

  const bytes = await buildDocumentPdf(tab)
  const { pdf, destroy } = await loadPdfDocument(bytes)
  try {
    const render = async (pageNumber: number): Promise<Uint8Array<ArrayBuffer>> => {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: options.scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas is unavailable.')
      // Paper-white backing so transparent regions don't render black in JPEG.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, viewport }).promise
      return canvasToBytes(canvas, options.format)
    }

    if (pageNumbers.length === 1) {
      const pageNumber = pageNumbers[0]!
      const path = await window.api.showSaveDialog({
        defaultName: imageFileName(tab.name, pageNumber, options.format)
      })
      if (!path) return 0
      await window.api.writeFile({ path, bytes: await render(pageNumber) })
      return 1
    }

    const dir = await window.api.selectDirectory()
    if (!dir) return 0
    let count = 0
    for (const pageNumber of pageNumbers) {
      await window.api.writeFileInDir({
        dir,
        name: imageFileName(tab.name, pageNumber, options.format),
        bytes: await render(pageNumber)
      })
      count += 1
    }
    return count
  } finally {
    await destroy()
  }
}
