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

test('draw a rectangle annotation, save it into a valid PDF, then undo', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 20_000 })

  // Pick the rectangle tool and drag a box on page 1.
  await window.getByTitle('Rectangle').click()
  const box = await window.locator('[data-page-number="1"]').boundingBox()
  expect(box).not.toBeNull()
  const x = box!.x + 60
  const y = box!.y + 60
  await window.mouse.move(x, y)
  await window.mouse.down()
  await window.mouse.move(x + 140, y + 100, { steps: 8 })
  await window.mouse.up()

  // The annotation was committed → undo is now available.
  await expect(window.getByTitle('Undo (Ctrl+Z)')).toBeEnabled()

  // Save As (stubbed dialog) and confirm a valid PDF with the original 8 pages.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-annot-')), 'out.pdf')
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

  // Undo removes the annotation.
  await window.getByTitle('Undo (Ctrl+Z)').click()
  await expect(window.getByTitle('Undo (Ctrl+Z)')).toBeDisabled()
})
