import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('add a tokenized header & footer across pages and flatten on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  await window.getByTitle('Watermark & page numbers').click()
  await expect(window.getByText('Insert across pages')).toBeVisible()

  // A tokenized footer-center and a plain header-left.
  await window.getByLabel('footer center').fill('Page {page} of {pages}')
  await window.getByLabel('header left').fill('CONFIDENTIAL')
  await window.getByRole('button', { name: 'Add header & footer' }).click()

  // Page 1 (of 8) gets the expanded footer plus the header text as annotations.
  await expect(window.locator('[data-page-number] textarea').first()).toBeVisible({
    timeout: 20_000
  })
  await expect
    .poll(
      async () => {
        const values = await window
          .locator('[data-page-number] textarea')
          .evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value))
        return values.includes('Page 1 of 8') && values.includes('CONFIDENTIAL')
      },
      { timeout: 20_000 }
    )
    .toBe(true)
  await expect(window.getByTitle('Undo (Ctrl+Z)')).toBeEnabled()

  // Saving flattens everything into a valid 8-page PDF.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-hf-')), 'out.pdf')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, outPath)
  await window.keyboard.press('Control+Shift+S')
  await expect
    .poll(
      () => {
        try {
          return readFileSync(outPath).length
        } catch {
          return 0
        }
      },
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0)
  expect((await PDFDocument.load(readFileSync(outPath))).getPageCount()).toBe(8)
})
