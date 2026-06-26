import { createWorker, type Worker as TesseractWorker } from 'tesseract.js'
import type { PdfPage } from '@/lib/pdf'

/** A recognized word, mapped into PDF page space (baseline-left, y-up). */
export interface OcrWord {
  text: string
  x: number
  y: number
  fontSize: number
}

export interface OcrPageResult {
  words: OcrWord[]
  text: string
}

/** Render scale for the OCR input image (higher = better accuracy, slower). */
const OCR_SCALE = 2

let workerPromise: Promise<TesseractWorker> | null = null
let workerLang: string | null = null
let progressHandler: ((status: string, progress: number) => void) | null = null

export function onOcrProgress(handler: ((status: string, progress: number) => void) | null): void {
  progressHandler = handler
}

async function getWorker(lang: string): Promise<TesseractWorker> {
  if (workerPromise && workerLang === lang) return workerPromise

  // Language changed: tear the old worker down (its data is no longer needed)
  // and build a fresh one for the requested language.
  if (workerPromise) {
    const previous = workerPromise
    workerPromise = null
    workerLang = null
    void previous.then((worker) => worker.terminate()).catch(() => {})
  }

  // All asset paths are bundled locally (see electron.vite.config.ts) so OCR
  // runs fully offline. tesseract.js spawns its own worker — the UI never blocks.
  workerLang = lang
  workerPromise = createWorker(lang, 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/core',
    langPath: '/tessdata',
    logger: (message: { status?: string; progress?: number }) => {
      progressHandler?.(message.status ?? '', message.progress ?? 0)
    }
  })
  return workerPromise
}

interface RawWord {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

function collectWords(data: unknown): RawWord[] {
  const result: RawWord[] = []
  const d = data as {
    words?: RawWord[]
    blocks?: { paragraphs?: { lines?: { words?: RawWord[] }[] }[] }[]
  }
  if (Array.isArray(d.words)) return d.words
  for (const block of d.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) result.push(word)
      }
    }
  }
  return result
}

/**
 * OCRs a PDF page: renders it to an image, recognizes the text with tesseract
 * (in the given bundled language), and maps each word's pixel box into PDF page
 * space (ready for an invisible text layer).
 */
export async function recognizePage(page: PdfPage, lang = 'eng'): Promise<OcrPageResult> {
  const pageHeight = page.getViewport({ scale: 1 }).height
  const viewport = page.getViewport({ scale: OCR_SCALE })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create an OCR canvas.')
  await page.render({ canvas, viewport }).promise

  const worker = await getWorker(lang)
  const { data } = await worker.recognize(canvas, {}, { blocks: true })

  const words: OcrWord[] = []
  for (const word of collectWords(data)) {
    if (!word.text || word.text.trim() === '') continue
    const { x0, y0, y1 } = word.bbox
    words.push({
      text: word.text,
      x: x0 / OCR_SCALE,
      y: pageHeight - y1 / OCR_SCALE,
      fontSize: Math.max(4, (y1 - y0) / OCR_SCALE)
    })
  }
  return { words, text: (data as { text?: string }).text ?? '' }
}

/** Releases the OCR worker (e.g. on teardown). */
export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise
    await worker.terminate()
    workerPromise = null
    workerLang = null
  }
}
