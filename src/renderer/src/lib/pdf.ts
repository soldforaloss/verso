import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/**
 * Central PDF.js setup for the renderer.
 *
 * The worker is referenced with Vite's `?url` import so it is emitted as a
 * hashed asset and loaded with the correct MIME type in both dev and the
 * packaged `app://` build. cMaps and the standard-14 font data are bundled by
 * `vite-plugin-static-copy` and served from the app origin (see the Vite
 * config), keeping rendering fully offline.
 */
GlobalWorkerOptions.workerSrc = workerUrl

const CMAP_URL = '/cmaps/'
const STANDARD_FONT_DATA_URL = '/standard_fonts/'

// Derive the proxy/viewport/task types from the runtime API so we never depend
// on type names that may not be re-exported from the package entry point.
export type PdfDocument = Awaited<ReturnType<typeof getDocument>['promise']>
export type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>
export type PageViewport = ReturnType<PdfPage['getViewport']>
export type RenderTask = ReturnType<PdfPage['render']>
export type TextContent = Awaited<ReturnType<PdfPage['getTextContent']>>
export type TextContentItem = TextContent['items'][number]

export interface LoadedPdf {
  pdf: PdfDocument
  /** Tears down the worker and frees resources (call when closing a document). */
  destroy: () => Promise<void>
}

/**
 * Loads a PDF from bytes. The bytes are copied first because PDF.js may transfer
 * (detach) the underlying buffer to its worker — callers keep their original
 * `Uint8Array` intact (needed later for saving/editing).
 *
 * Returns a `destroy` function bound to the loading task (the proxy itself has
 * no destroy in v6) so callers can fully release the document.
 */
export async function loadPdfDocument(bytes: Uint8Array): Promise<LoadedPdf> {
  const task = getDocument({
    data: bytes.slice(),
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL
  })
  const pdf = await task.promise
  return { pdf, destroy: () => task.destroy() }
}

export { TextLayer }
