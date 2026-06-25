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

test('place a stamp on the page and flatten it on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number] canvas').first()).toBeVisible({ timeout: 30_000 })

  await window.getByTitle('Add stamp').click()
  await expect(window.getByText('Add a stamp')).toBeVisible()
  await window.getByRole('button', { name: 'APPROVED', exact: true }).click()

  // The stamp lands on the current page as a movable image annotation.
  await expect(window.locator('[data-page-number] img')).toBeVisible({ timeout: 20_000 })

  // Save flattens it into a valid PDF.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-stamp-')), 'out.pdf')
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
