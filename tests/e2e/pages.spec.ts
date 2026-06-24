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

test('page operations are undoable and Save As writes a valid PDF', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })

  // Delete the current page → 7 pages.
  await window.getByTitle('Delete').click()
  await expect(window.getByText('/ 7')).toBeVisible()

  // Stub the native Save dialog to a temp path, then Save As (Ctrl+Shift+S).
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-save-')), 'out.pdf')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, outPath)
  await window.keyboard.press('Control+Shift+S')

  // The written file must be a valid 7-page PDF.
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
  expect(saved.getPageCount()).toBe(7)

  // Undo restores 8 pages; redo returns to 7.
  await window.getByTitle('Undo (Ctrl+Z)').click()
  await expect(window.getByText('/ 8')).toBeVisible()
  await window.getByTitle('Redo (Ctrl+Y)').click()
  await expect(window.getByText('/ 7')).toBeVisible()
})
