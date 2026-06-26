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

test('crop a page and apply it via setCropBox on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Open the crop dialog and trim 20% off the top of the current page.
  await window.getByTitle('Crop pages').click()
  await expect(window.getByText(/Trim the margins of page 1/)).toBeVisible()
  await window.getByLabel('Top margin').fill('20')
  await window.getByRole('button', { name: 'Crop page' }).click()

  // The crop is now visible in the viewer as a margin mask.
  await expect(window.locator('[data-page-number="1"] [data-testid="crop-overlay"]')).toBeVisible({
    timeout: 10_000
  })

  // Save and verify the saved PDF's crop box is shorter than its media box.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-crop-')), 'out.pdf')
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

  const doc = await PDFDocument.load(readFileSync(outPath))
  const page = doc.getPage(0)
  const media = page.getMediaBox()
  const crop = page.getCropBox()
  expect(crop.width).toBeCloseTo(media.width, 0) // full width kept
  expect(crop.height).toBeLessThan(media.height - 100) // ~20% trimmed off the top
})
