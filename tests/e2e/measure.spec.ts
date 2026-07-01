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

test('measures a distance and places a labelled measurement that flattens on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const canvas = window.locator('[data-page-number="1"] canvas')
  await expect(canvas).toBeVisible({ timeout: 30_000 })

  // Activate the Measure tool (default unit is inches).
  await window.getByTitle('Measure distance').click()

  // Drag a horizontal segment across the page.
  const box = (await canvas.boundingBox())!
  await window.mouse.move(box.x + 60, box.y + 120)
  await window.mouse.down()
  await window.mouse.move(box.x + 260, box.y + 120, { steps: 10 })
  await window.mouse.up()

  // A measurement label (a text annotation) appears with a value in inches.
  await expect
    .poll(
      async () => {
        const values = await window
          .locator('[data-page-number] textarea')
          .evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value))
        return values.some((v) => / in$/.test(v))
      },
      { timeout: 20_000 }
    )
    .toBe(true)
  await expect(window.getByTitle('Undo (Ctrl+Z)')).toBeEnabled()

  // The measurement (line + label) flattens into a still-valid 8-page PDF.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-measure-')), 'out.pdf')
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
