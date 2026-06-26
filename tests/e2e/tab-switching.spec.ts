import { test, expect, type ElectronApplication } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('Ctrl+number and Ctrl+Tab switch between document tabs', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })

  // Open a second document (3 pages) so the page count distinguishes the tabs.
  const doc = await PDFDocument.create()
  for (let i = 0; i < 3; i += 1) doc.addPage([300, 400])
  const base64 = Buffer.from(await doc.save()).toString('base64')
  await app.evaluate(({ BrowserWindow }, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const document = { id: globalThis.crypto.randomUUID(), name: 'three.pdf', path: null, bytes }
    BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
  }, base64)

  // The new doc becomes active (3 pages).
  await expect(window.getByText('/ 3')).toBeVisible({ timeout: 20_000 })

  // Ctrl+1 jumps to the first tab (8 pages); Ctrl+2 back to the second.
  await window.keyboard.press('Control+1')
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 10_000 })
  await window.keyboard.press('Control+2')
  await expect(window.getByText('/ 3')).toBeVisible({ timeout: 10_000 })

  // Ctrl+Tab cycles back to the first tab.
  await window.keyboard.press('Control+Tab')
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 10_000 })
})
