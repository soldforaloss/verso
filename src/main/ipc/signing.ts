import { BrowserWindow, dialog } from 'electron'
import { readFile } from 'node:fs/promises'
import { SignPdfRequestSchema } from '@shared/ipc'
import { IpcChannels } from '@shared/channels'
import { handle } from './registry'
import { signPdf } from '../pdfSign'

function windowFor(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0]
  if (!window) throw new Error('No window available for the dialog.')
  return window
}

/** Registers the digital-signature handler. */
export function registerSigningHandlers(): void {
  handle(IpcChannels.signPdf, SignPdfRequestSchema, async (request, event) => {
    // Choose the certificate in the main process — the private key never enters
    // the renderer. A cancelled picker resolves to null (no error).
    const result = await dialog.showOpenDialog(windowFor(event), {
      title: 'Choose a signing certificate',
      properties: ['openFile'],
      filters: [{ name: 'Certificates (PKCS#12)', extensions: ['p12', 'pfx'] }]
    })
    const certPath = result.canceled ? undefined : result.filePaths[0]
    if (!certPath) return null

    const p12 = new Uint8Array(await readFile(certPath))
    return signPdf(request.bytes, p12, request.passphrase, {
      reason: request.reason,
      name: request.name,
      location: request.location,
      contactInfo: request.contactInfo
    })
  })
}
