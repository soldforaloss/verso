import { randomUUID } from 'node:crypto'
import { basename, extname, join } from 'node:path'
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises'
import { app, dialog, type BrowserWindow } from 'electron'
import log from 'electron-log/main'
import {
  PreferencesSchema,
  RecentFileSchema,
  type OpenedDocument,
  type PartialPreferences,
  type Preferences,
  type RecentFile
} from '@shared/ipc'
import { z } from 'zod'

/** Largest PDF we will load into memory (guards against OOM / hostile input). */
const MAX_PDF_BYTES = 512 * 1024 * 1024
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

  return {
    id: randomUUID(),
    name: basename(path),
    path,
    bytes: new Uint8Array(buffer)
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
