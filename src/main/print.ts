import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { writeFile, unlink } from 'node:fs/promises'
import { BrowserWindow } from 'electron'
import log from 'electron-log/main'
import type { PrintPdfRequest } from '@shared/ipc'

/**
 * Prints a PDF by loading its bytes into an offscreen window that uses
 * Chromium's built-in PDF viewer, then invoking the OS print dialog.
 *
 * The window is sandboxed with no Node integration and only ever loads a
 * file we just wrote — never remote content. `plugins: true` is required for
 * Chromium to render the PDF; it is scoped to this throwaway window alone.
 */
export async function printPdf(request: PrintPdfRequest): Promise<void> {
  const path = join(tmpdir(), `verso-print-${randomUUID()}.pdf`)
  await writeFile(path, request.bytes)

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true
    }
  })

  try {
    await win.loadURL(pathToFileURL(path).href)
    await new Promise<void>((resolve) => {
      win.webContents.print({ silent: false }, (success, reason) => {
        if (!success && reason && reason !== 'cancelled') {
          log.warn('[print] print failed:', reason)
        }
        resolve()
      })
    })
  } finally {
    if (!win.isDestroyed()) win.destroy()
    await unlink(path).catch(() => {})
  }
}
