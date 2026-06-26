import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument, PDFDict, PDFHexString, PDFName } from 'pdf-lib'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('add and rename a bookmark, then write it into the PDF on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Open the Bookmarks (Outline) panel and add a bookmark for the current page.
  await window.getByRole('button', { name: 'Outline' }).click()
  await window.getByTitle('Add a bookmark for the current page').click()

  // It appears titled "Page 1"; rename it to "Intro".
  const row = window.getByRole('button', { name: 'Page 1' })
  await expect(row).toBeVisible()
  await row.dblclick()
  const input = window.getByLabel('Bookmark title')
  await input.fill('Intro')
  await input.press('Enter')
  await expect(window.getByRole('button', { name: 'Intro' })).toBeVisible()

  // Save, then verify the saved PDF carries an /Outlines entry titled "Intro".
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-outline-')), 'out.pdf')
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
  const outlines = doc.catalog.lookup(PDFName.of('Outlines'), PDFDict)
  expect(outlines).toBeDefined()
  const last = outlines.lookup(PDFName.of('Last'), PDFDict)
  const title = (last.lookup(PDFName.of('Title'), PDFHexString) as PDFHexString).decodeText()
  expect(title).toBe('Intro')
})

test('undoing the first bookmark edit restores the original (no /Outlines written)', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  await window.getByRole('button', { name: 'Outline' }).click()
  await window.getByTitle('Add a bookmark for the current page').click()
  await expect(window.getByRole('button', { name: 'Page 1' })).toBeVisible()

  // Undo returns to the pass-through state (tab.outline back to null).
  await window.keyboard.press('Control+z')
  await expect(window.getByRole('button', { name: 'Page 1' })).toBeHidden()

  // The fixture had no outline, so saving must not write one.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-outline-undo-')), 'out.pdf')
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
  expect(doc.catalog.has(PDFName.of('Outlines'))).toBe(false)
})
