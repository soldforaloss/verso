import { randomUUID } from 'node:crypto'
import { basename, extname, join } from 'node:path'
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises'
import { app, dialog, type BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { maybeDecrypt } from './qpdf'
import {
  PreferencesSchema,
  RecentFileSchema,
  type OpenedDocument,
  type PartialPreferences,
  type PickedImage,
  type Preferences,
  type RecentFile
} from '@shared/ipc'
import { z } from 'zod'

/** Largest PDF we will load into memory (guards against OOM / hostile input). */
const MAX_PDF_BYTES = 512 * 1024 * 1024
/** Largest raster image accepted for "Add image" (base64 in a data URL is +33%). */
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const MAX_RECENT = 15

const recentFilePath = (): string => join(app.getPath('userData'), 'recent-files.json')
const preferencesPath = (): string => join(app.getPath('userData'), 'preferences.json')

/** Writes JSON atomically: write a temp file, then rename over the target. */
async function writeJsonAtomic(target: string, value: unknown): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  const tmp = `${target}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await rename(tmp, target)
}

/** Writes bytes atomically (temp file, then rename over the target). */
async function writeBytesAtomic(target: string, bytes: Uint8Array): Promise<void> {
  const tmp = `${target}.${randomUUID()}.tmp`
  await writeFile(tmp, bytes)
  await rename(tmp, target)
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

// --- Documents -------------------------------------------------------------

/** Reads and validates a PDF from disk into an in-memory document. */
export async function readPdf(path: string): Promise<OpenedDocument> {
  if (extname(path).toLowerCase() !== '.pdf') {
    throw new Error('Only .pdf files can be opened.')
  }

  const info = await stat(path)
  if (!info.isFile()) throw new Error('Not a file.')
  if (info.size > MAX_PDF_BYTES) throw new Error('File is too large to open.')

  const buffer = await readFile(path)
  await addRecentFile(path)

  // Transparently lift owner-only encryption so the pdf-lib save path can edit
  // it (a restricted PDF renders but pdf-lib can't parse its encrypted objects).
  const bytes = await maybeDecrypt(new Uint8Array(buffer))

  return {
    id: randomUUID(),
    name: basename(path),
    path,
    bytes
  }
}

/** Shows the native open dialog and reads the chosen PDF (null if cancelled). */
export async function openFileDialog(window: BrowserWindow): Promise<OpenedDocument | null> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Open PDF',
    properties: ['openFile'],
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return readPdf(result.filePaths[0]!)
}

/**
 * Identifies a raster image by its magic bytes (never by extension). Returns the
 * mime type for the two formats pdf-lib can embed, or null for anything else.
 */
export function sniffImageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  return null
}

/** Shows the native image picker and returns the chosen PNG/JPEG (null if cancelled). */
export async function openImageDialog(window: BrowserWindow): Promise<PickedImage | null> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Add image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const path = result.filePaths[0]!
  const info = await stat(path)
  if (!info.isFile()) throw new Error('Not a file.')
  if (info.size > MAX_IMAGE_BYTES) throw new Error('Image is too large (max 30 MB).')

  const bytes = new Uint8Array(await readFile(path))
  const mime = sniffImageMime(bytes)
  if (!mime) throw new Error('Only PNG or JPEG images are supported.')
  return { bytes, mime }
}

// --- Recent files ----------------------------------------------------------

export async function getRecentFiles(): Promise<RecentFile[]> {
  const parsed = z.array(RecentFileSchema).safeParse(await readJson(recentFilePath()))
  return parsed.success ? parsed.data : []
}

export async function addRecentFile(path: string): Promise<void> {
  try {
    const existing = await getRecentFiles()
    const next: RecentFile[] = [
      { path, name: basename(path), lastOpenedAt: Date.now() },
      ...existing.filter((entry) => entry.path !== path)
    ].slice(0, MAX_RECENT)
    await writeJsonAtomic(recentFilePath(), next)
    app.addRecentDocument(path)
  } catch (error) {
    // A failure to record recents must never block opening a document.
    log.warn('[files] could not update recent files:', error)
  }
}

export async function clearRecentFiles(): Promise<void> {
  await writeJsonAtomic(recentFilePath(), [])
  app.clearRecentDocuments()
}

// --- Preferences -----------------------------------------------------------

export async function getPreferences(): Promise<Preferences> {
  // Parsing through the schema fills in defaults for any missing/invalid field.
  return PreferencesSchema.parse((await readJson(preferencesPath())) ?? {})
}

export async function setPreferences(update: PartialPreferences): Promise<Preferences> {
  const current = await getPreferences()
  const merged = PreferencesSchema.parse({ ...current, ...update })
  await writeJsonAtomic(preferencesPath(), merged)
  return merged
}

// --- Saving / exporting ----------------------------------------------------

export async function showSaveDialog(
  window: BrowserWindow,
  defaultName: string
): Promise<string | null> {
  const result = await dialog.showSaveDialog(window, {
    title: 'Save PDF',
    defaultPath: defaultName,
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
  })
  return result.canceled || !result.filePath ? null : result.filePath
}

export async function selectDirectory(window: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Choose a folder',
    properties: ['openDirectory', 'createDirectory']
  })
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]!
}

export async function writePdf(path: string, bytes: Uint8Array): Promise<void> {
  await writeBytesAtomic(path, bytes)
}

export async function writePdfInDir(dir: string, name: string, bytes: Uint8Array): Promise<string> {
  // Guard against path traversal in the supplied file name.
  const safeName = basename(name)
  const target = join(dir, safeName)
  await writeBytesAtomic(target, bytes)
  return target
}
