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

test('cover-&-replace edits an existing text run and saves a valid PDF', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Wait for the text layer of page 1, then activate the edit-text tool.
  const run = window.locator('[data-page-number="1"] .textLayer span', {
    hasText: 'Verso sample page 1'
  })
  await expect(run).toBeVisible({ timeout: 20_000 })
  await window.getByTitle('Edit existing text (cover & replace)').click()

  // Click the run; the overlay covers it and drops an editable text box.
  const box = await run.boundingBox()
  expect(box).not.toBeNull()
  await window.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

  // The editable replacement is pre-filled with the original string.
  await expect(window.locator('textarea').first()).toHaveValue(/Verso sample page 1/, {
    timeout: 10_000
  })
  await expect(window.getByTitle('Undo (Ctrl+Z)')).toBeEnabled()

  // Save flattens the edit into a valid PDF.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-edit-')), 'edited.pdf')
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
  const saved = await PDFDocument.load(readFileSync(outPath))
  expect(saved.getPageCount()).toBe(8)
})
