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

test('type a signature, place it, and flatten it on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  await window.getByTitle('Add signature').click()
  await expect(window.getByText('Add a signature')).toBeVisible()
  await window.getByRole('button', { name: 'type', exact: true }).click()
  await window.getByPlaceholder('Type your name').fill('Thomas Rush')
  await window.getByRole('button', { name: 'Insert signature' }).click()

  // The signature lands on page 1 as a movable image annotation.
  await expect(window.locator('[data-page-number="1"] img')).toBeVisible({ timeout: 20_000 })

  // Save flattens it (embedPng) into a valid PDF.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-sign-')), 'signed.pdf')
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

test('draw a signature and place it', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  await window.getByTitle('Add signature').click()
  const pad = window.locator('canvas').last()
  const box = await pad.boundingBox()
  expect(box).not.toBeNull()
  // Scribble a few strokes across the pad.
  await window.mouse.move(box!.x + 40, box!.y + 100)
  await window.mouse.down()
  await window.mouse.move(box!.x + 140, box!.y + 60, { steps: 6 })
  await window.mouse.move(box!.x + 240, box!.y + 130, { steps: 6 })
  await window.mouse.move(box!.x + 360, box!.y + 70, { steps: 6 })
  await window.mouse.up()

  await window.getByRole('button', { name: 'Insert signature' }).click()
  await expect(window.locator('[data-page-number="1"] img')).toBeVisible({ timeout: 20_000 })
})
