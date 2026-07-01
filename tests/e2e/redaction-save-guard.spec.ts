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

async function openWithMarkableSecret(app: ElectronApplication): Promise<void> {
  const window = await app.firstWindow()
  await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
    timeout: 30_000
  })
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p1 = doc.addPage([400, 300])
  p1.drawText('SECRET', { x: 40, y: 200, size: 40, font })
  const p2 = doc.addPage([400, 300])
  p2.drawText('KEEP', { x: 40, y: 200, size: 40, font })
  const base64 = Buffer.from(await doc.save()).toString('base64')
  await app.evaluate(({ BrowserWindow }, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const document = { id: globalThis.crypto.randomUUID(), name: 'secret.pdf', path: null, bytes }
    BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
  }, base64)
  await expect(window.locator('[data-page-number="1"] .textLayer')).toContainText('SECRET', {
    timeout: 30_000
  })
  // Mark a redaction over page 1.
  await window.getByTitle('Redaction (black out & destroy content)').click()
  const box = (await window.locator('[data-page-number="1"]').boundingBox())!
  await window.mouse.move(box.x + 30, box.y + 30)
  await window.mouse.down()
  await window.mouse.move(box.x + 260, box.y + 200, { steps: 8 })
  await window.mouse.up()
}

function expectFileWritten(path: string): Promise<void> {
  return expect
    .poll(
      () => {
        try {
          return readFileSync(path).length
        } catch {
          return 0
        }
      },
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0)
}

test('saving with unapplied redaction marks warns, and "Apply & save" secures the file', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await openWithMarkableSecret(app)

  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-rsg-')), 'out.pdf')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, outPath)

  // Ctrl+S raises the guard instead of writing a leaky file.
  await window.keyboard.press('Control+s')
  await expect(window.getByText('Redactions not applied')).toBeVisible({ timeout: 15_000 })

  // Apply & save rasterizes page 1 and writes the secured document.
  await window.getByRole('button', { name: 'Apply & save' }).click()
  await expectFileWritten(outPath)

  // The in-app page lost its selectable secret, and the saved file is valid.
  await expect(window.locator('[data-page-number="1"] .textLayer')).not.toContainText('SECRET', {
    timeout: 30_000
  })
  expect((await PDFDocument.load(readFileSync(outPath))).getPageCount()).toBe(2)
})

test('"Save anyway" writes the cover-up file without rasterizing', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await openWithMarkableSecret(app)

  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-rsg2-')), 'out.pdf')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, outPath)

  await window.keyboard.press('Control+s')
  await expect(window.getByText('Redactions not applied')).toBeVisible({ timeout: 15_000 })
  await window.getByRole('button', { name: 'Save anyway' }).click()
  await expectFileWritten(outPath)

  // Not rasterized: the page keeps its text layer (the cover-up is only cosmetic).
  await expect(window.locator('[data-page-number="1"] .textLayer')).toContainText('SECRET')
})

test('digital signing is blocked while redaction marks are unapplied', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await openWithMarkableSecret(app)

  await window.getByTitle('Digitally sign (certificate)').click()
  await expect(window.getByText('Certificate passphrase')).toBeVisible()
  await window.locator('input[type="password"]').first().fill('whatever')
  await window.getByRole('button', { name: 'Choose certificate & sign' }).click()

  // The guard refuses before any signing/cert step, telling the user to apply first.
  await expect(window.getByText(/Apply your redaction marks before signing/)).toBeVisible({
    timeout: 15_000
  })
})

test('extract is blocked and offers to apply redactions first', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await openWithMarkableSecret(app)

  await window.getByTitle('Extract selection to a new PDF…').click()

  // Instead of writing a leaky subset, the shared block dialog appears.
  await expect(window.getByText('Apply redactions first')).toBeVisible({ timeout: 15_000 })
  await window.getByRole('button', { name: 'Apply redactions' }).click()

  // Applying rasterizes the marked page (its secret leaves the text layer).
  await expect(window.locator('[data-page-number="1"] .textLayer')).not.toContainText('SECRET', {
    timeout: 30_000
  })
})
