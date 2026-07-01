import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('exports the document text to a .txt file across pages', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
    timeout: 30_000
  })

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p1 = doc.addPage([400, 300])
  p1.drawText('The quick brown fox', { x: 40, y: 200, size: 18, font })
  const p2 = doc.addPage([400, 300])
  p2.drawText('Second page content', { x: 40, y: 200, size: 18, font })
  const base64 = Buffer.from(await doc.save()).toString('base64')
  await app.evaluate(({ BrowserWindow }, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const document = { id: globalThis.crypto.randomUUID(), name: 'notes.pdf', path: null, bytes }
    BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
  }, base64)
  await expect(window.locator('[data-page-number="1"] .textLayer')).toContainText('quick brown', {
    timeout: 30_000
  })

  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-txt-')), 'notes.txt')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, outPath)

  // Export → Text → all pages.
  await window.getByTitle('Export (image or text)').click()
  await window.getByRole('button', { name: 'Text', exact: true }).click()
  await window.getByRole('button', { name: /All pages/ }).click()
  await window.getByRole('button', { name: 'Export', exact: true }).click()

  await expect
    .poll(
      () => {
        try {
          return readFileSync(outPath, 'utf8')
        } catch {
          return ''
        }
      },
      { timeout: 15_000 }
    )
    .toContain('Second page content')
  const text = readFileSync(outPath, 'utf8')
  expect(text).toContain('The quick brown fox')
})

test('text export is blocked while redaction marks are unapplied (no leak)', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
    timeout: 30_000
  })

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  doc.addPage([400, 300]).drawText('SECRET', { x: 40, y: 200, size: 40, font })
  const base64 = Buffer.from(await doc.save()).toString('base64')
  await app.evaluate(({ BrowserWindow }, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const document = { id: globalThis.crypto.randomUUID(), name: 'secret.pdf', path: null, bytes }
    BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
  }, base64)
  await expect(window.locator('[data-page-number="1"] .textLayer')).toContainText('SECRET', {
    timeout: 30_000
  })

  // Mark a redaction over the page.
  await window.getByTitle('Redaction (black out & destroy content)').click()
  const box = (await window.locator('[data-page-number="1"]').boundingBox())!
  await window.mouse.move(box.x + 30, box.y + 30)
  await window.mouse.down()
  await window.mouse.move(box.x + 260, box.y + 200, { steps: 8 })
  await window.mouse.up()

  // Text export must refuse and offer to apply, not silently extract the secret.
  await window.getByTitle('Export (image or text)').click()
  await window.getByRole('button', { name: 'Text', exact: true }).click()
  await window.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(window.getByText('Apply redactions first')).toBeVisible({ timeout: 15_000 })
})
