import { test, expect, type ElectronApplication } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('find & redact: search a term, mark every match, and destroy it on apply', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
    timeout: 30_000
  })

  // Page 1 carries the secret twice; page 2 (never redacted) must survive intact.
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p1 = doc.addPage([400, 300])
  p1.drawText('SECRET', { x: 40, y: 220, size: 32, font })
  p1.drawText('SECRET', { x: 40, y: 120, size: 32, font })
  const p2 = doc.addPage([400, 300])
  p2.drawText('KEEPVISIBLE', { x: 40, y: 200, size: 32, font })
  const base64 = Buffer.from(await doc.save()).toString('base64')

  await app.evaluate(({ BrowserWindow }, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const document = { id: globalThis.crypto.randomUUID(), name: 'secret.pdf', path: null, bytes }
    BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
  }, base64)

  await expect(window.locator('[data-page-number="1"] .textLayer')).toContainText('SECRET', {
    timeout: 30_000
  })

  // Open Find, search for the secret, and wait for both matches.
  await window.keyboard.press('Control+f')
  await window.getByLabel('Find in document').fill('SECRET')
  await expect(window.getByTestId('search-status')).toHaveText('1 of 2', { timeout: 15_000 })

  // Mark every match for redaction; the bar closes and Apply becomes available.
  await window.getByRole('button', { name: 'Mark matches for redaction' }).click()
  await window.getByTitle('Apply redactions (permanent)').click()
  await expect(window.getByText('Apply redactions')).toBeVisible()
  await window.getByRole('button', { name: 'Redact permanently' }).click()

  // Both occurrences of the secret are gone from page 1's text layer; the
  // untouched page 2 keeps its real, selectable text.
  await expect(window.locator('[data-page-number="1"] .textLayer')).not.toContainText('SECRET', {
    timeout: 30_000
  })
  await expect(window.locator('[data-page-number="2"] .textLayer')).toContainText('KEEPVISIBLE')
})
