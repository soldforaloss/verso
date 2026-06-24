import { test, expect, type ElectronApplication } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('redaction rasterizes the page so the text beneath is unrecoverable', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
    timeout: 30_000
  })

  // Build a two-page PDF with real, selectable text on each page.
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p1 = doc.addPage([400, 300])
  p1.drawText('REDACTME', { x: 40, y: 200, size: 40, font })
  const p2 = doc.addPage([400, 300])
  p2.drawText('KEEPVISIBLE', { x: 40, y: 200, size: 40, font })
  const base64 = Buffer.from(await doc.save()).toString('base64')

  await app.evaluate(({ BrowserWindow }, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const document = { id: globalThis.crypto.randomUUID(), name: 'secret.pdf', path: null, bytes }
    BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
  }, base64)

  // The text starts out as a real, selectable text layer.
  await expect(window.locator('[data-page-number="1"] .textLayer')).toContainText('REDACTME', {
    timeout: 30_000
  })

  // Mark a redaction over page 1.
  await window.getByTitle('Redaction (black out & destroy content)').click()
  const box = await window.locator('[data-page-number="1"]').boundingBox()
  expect(box).not.toBeNull()
  await window.mouse.move(box!.x + 30, box!.y + 30)
  await window.mouse.down()
  await window.mouse.move(box!.x + 220, box!.y + 160, { steps: 8 })
  await window.mouse.up()

  // Apply the redaction permanently.
  await window.getByTitle('Apply redactions (permanent)').click()
  await expect(window.getByText('Apply redactions')).toBeVisible()
  await window.getByRole('button', { name: 'Redact permanently' }).click()

  // Page 1 is now an image: its text layer no longer carries the secret.
  await expect(window.locator('[data-page-number="1"] .textLayer')).not.toContainText('REDACTME', {
    timeout: 30_000
  })
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible()

  // The document still has both pages — page 2 was copied losslessly.
  await expect(window.getByText('/ 2')).toBeVisible()
})
