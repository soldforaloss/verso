import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

// A minimal but valid PNG the picker will return.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

test('adds an image from disk and flattens it into the saved PDF', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'verso-img-insert-'))
  const imgPath = join(dir, 'logo.png')
  writeFileSync(imgPath, PNG)

  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number] canvas').first()).toBeVisible({ timeout: 30_000 })

  // Stub the native image picker to return our file.
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, imgPath)

  await window.getByTitle('Add image (from file)').click()

  // It lands on the current page as a movable image annotation.
  await expect(window.locator('[data-page-number] img')).toBeVisible({ timeout: 20_000 })
  await expect(window.locator('[title="Unsaved changes"]')).toBeVisible({ timeout: 20_000 })

  // Save flattens it into a still-valid PDF.
  const outPath = join(dir, 'out.pdf')
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

test('a non-image file surfaces an error dialog instead of silently failing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'verso-img-bad-'))
  const badPath = join(dir, 'notes.txt')
  writeFileSync(badPath, 'this is not an image')

  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number] canvas').first()).toBeVisible({ timeout: 30_000 })

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, badPath)

  await window.getByTitle('Add image (from file)').click()

  // The rejection is caught and reported (not swallowed); no image is placed.
  await expect(window.getByText("Couldn't add image")).toBeVisible({ timeout: 15_000 })
  await expect(window.getByText(/Only PNG or JPEG/)).toBeVisible()
  await expect(window.locator('[data-page-number] img')).toHaveCount(0)
})
