import { PDFDocument } from 'pdf-lib'
import { loadPdfDocument } from '@/lib/pdf'
import { buildDocumentPdf } from '@/lib/save'
import type { DocumentTab } from '@/store/documentStore'

/** Render scale for redacted pages (2 = 144 dpi). */
const RASTER_SCALE = 2

function toArrayBufferBytes(saved: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(saved.length)
  bytes.set(saved)
  return bytes
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), 'image/png')
  )
  if (!blob) throw new Error('Failed to rasterize the page.')
  return new Uint8Array(await blob.arrayBuffer())
}

/** 1-based logical page numbers that carry at least one redaction mark. */
export function redactedPageNumbers(tab: DocumentTab): number[] {
  const result: number[] = []
  tab.pages.forEach((ref, index) => {
    if ((tab.annotations[ref.key] ?? []).some((annotation) => annotation.type === 'redaction')) {
      result.push(index + 1)
    }
  })
  return result
}

/**
 * Applies redaction marks by **rasterizing** every page that carries one.
 *
 * The document is first materialized, which flattens each redaction into an
 * opaque black box over the content. Pages with a mark are then re-rendered to
 * an image and re-embedded as image-only pages, so no text, vector, or hidden
 * content survives beneath the box — this is the irreversible, secure path that
 * separates true redaction from a cosmetic white/black-out. Pages without a
 * mark are copied losslessly and keep their selectable text.
 *
 * Returns the redacted PDF bytes; the caller replaces the in-memory document
 * with them so any subsequent save is secure by construction.
 */
export async function applyRedactions(tab: DocumentTab): Promise<Uint8Array<ArrayBuffer>> {
  const targets = new Set(redactedPageNumbers(tab))
  if (targets.size === 0) throw new Error('There are no redaction marks to apply.')

  const built = await buildDocumentPdf(tab)
  const srcDoc = await PDFDocument.load(built)
  const { pdf, destroy } = await loadPdfDocument(built)
  try {
    const out = await PDFDocument.create()
    for (let pageNumber = 1; pageNumber <= tab.pages.length; pageNumber += 1) {
      if (targets.has(pageNumber)) {
        const page = await pdf.getPage(pageNumber)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: RASTER_SCALE })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas is unavailable.')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, viewport }).promise
        const image = await out.embedPng(await canvasToPngBytes(canvas))
        const replacement = out.addPage([base.width, base.height])
        replacement.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height })
      } else {
        const [copied] = await out.copyPages(srcDoc, [pageNumber - 1])
        if (copied) out.addPage(copied)
      }
    }
    return toArrayBufferBytes(await out.save())
  } finally {
    await destroy()
  }
}
