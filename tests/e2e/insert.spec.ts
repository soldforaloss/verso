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

test('add a watermark across pages and flatten it on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  await window.getByTitle('Watermark & page numbers').click()
  await expect(window.getByText('Insert across pages')).toBeVisible()
  await window.getByRole('button', { name: 'Add watermark' }).click()

  // The watermark lands on page 1 (and every page) as an editable text annotation.
  await expect(window.locator('[data-page-number="1"] textarea').first()).toHaveValue(
    'CONFIDENTIAL',
    { timeout: 10_000 }
  )
  await expect(window.getByTitle('Undo (Ctrl+Z)')).toBeEnabled()

  // Saving flattens it into a valid 8-page PDF.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-wm-')), 'out.pdf')
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

test('add page numbers across pages', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  await window.getByTitle('Watermark & page numbers').click()
  await window.getByRole('button', { name: 'Add page numbers' }).click()

  // Page 1 gets the number "1".
  await expect(window.locator('[data-page-number="1"] textarea').first()).toHaveValue('1', {
    timeout: 10_000
  })
})
