import { test, expect, type ElectronApplication } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

// OCR (tesseract init + recognition) is heavy; give it room.
test.setTimeout(120_000)

test('OCRs a scanned PDF into a selectable text layer', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
    timeout: 30_000
  })

  // Render a high-contrast text image in the renderer (a stand-in "scan").
  const pngDataUrl = await window.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 900
    canvas.height = 240
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'
    ctx.font = '64px sans-serif'
    ctx.fillText('INVOICE 2026', 40, 140)
    return canvas.toDataURL('image/png')
  })

  // Build an image-only (scanned) PDF from it and open it in the app.
  const pngBytes = Buffer.from(pngDataUrl.split(',')[1]!, 'base64')
  const doc = await PDFDocument.create()
  const image = await doc.embedPng(pngBytes)
  const page = doc.addPage([image.width, image.height])
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  const base64 = Buffer.from(await doc.save()).toString('base64')

  await app.evaluate(({ BrowserWindow }, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const document = { id: globalThis.crypto.randomUUID(), name: 'scanned.pdf', path: null, bytes }
    BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
  }, base64)

  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Run OCR and wait for the button to return to its idle "OCR" state.
  await window.getByRole('button', { name: 'OCR', exact: true }).click()
  await expect(window.getByRole('button', { name: 'OCR', exact: true })).toBeEnabled({
    timeout: 90_000
  })

  // The recognized text is now a real, selectable text layer.
  await expect(window.locator('[data-page-number="1"] .textLayer')).toContainText('INVOICE', {
    timeout: 20_000
  })
})
