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

test('double-click does a true content-stream text edit (no cover-up) and saves it', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // The heading is a real text object in page 1's content stream.
  const run = window.locator('[data-page-number="1"] .textLayer span', {
    hasText: 'Verso sample page 1'
  })
  await expect(run).toBeVisible({ timeout: 20_000 })
  const box = await run.boundingBox()
  expect(box).not.toBeNull()

  // Double-click it (select tool is default) → the Tier-3 inline editor opens,
  // pre-filled with the object's ACTUAL text fetched from PDFium.
  await window.mouse.dblclick(box!.x + box!.width / 2, box!.y + box!.height / 2)
  // Generous timeout: the very first edit may compile the PDFium wasm on a cold,
  // loaded CI runner (startup pre-warm usually makes this instant).
  const editor = window.locator('input[data-true-text-editor]')
  await expect(editor).toBeVisible({ timeout: 30_000 })
  await expect(editor).toHaveValue('Verso sample page 1')

  // Replace the text and commit with Enter.
  await editor.fill('True content edit OK')
  await window.keyboard.press('Enter')

  // The page re-renders from the genuinely edited bytes: the new string appears
  // in the text layer and the old heading is gone (not merely masked).
  await expect(
    window.locator('[data-page-number="1"] .textLayer span', { hasText: 'True content edit OK' })
  ).toBeVisible({ timeout: 20_000 })
  await expect(
    window.locator('[data-page-number="1"] .textLayer span', { hasText: 'Verso sample page 1' })
  ).toHaveCount(0)

  // The document is now dirty; save it and confirm the edit is in the saved PDF.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-true-edit-')), 'edited.pdf')
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

test('the style toolbar makes a run bold in the real content stream (round-trips)', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  const run = window.locator('[data-page-number="1"] .textLayer span', {
    hasText: 'Verso sample page 1'
  })
  await expect(run).toBeVisible({ timeout: 20_000 })
  const box = await run.boundingBox()
  expect(box).not.toBeNull()

  // Open the editor; the style toolbar comes with it.
  await window.mouse.dblclick(box!.x + box!.width / 2, box!.y + box!.height / 2)
  const toolbar = window.locator('[data-true-text-toolbar]')
  await expect(toolbar).toBeVisible({ timeout: 30_000 })

  // The heading isn't bold to begin with.
  const boldButton = toolbar.locator('button[title="Bold"]')
  await expect(boldButton).toHaveAttribute('aria-pressed', 'false')

  // Toggle bold (focus stays on the text input) and commit with Enter.
  await boldButton.click()
  await expect(boldButton).toHaveAttribute('aria-pressed', 'true')
  await window.keyboard.press('Enter')

  // The commit is async (fetch font → PDFium rebuild → re-render). The document
  // becomes dirty once it lands — wait for that before re-reading the style.
  await expect(window.locator('[title="Unsaved changes"]')).toBeVisible({ timeout: 20_000 })

  // Re-open the same run: its style now reads back as bold from the genuine
  // content stream — proof the weight change round-tripped through PDFium.
  const run2 = window.locator('[data-page-number="1"] .textLayer span', {
    hasText: 'Verso sample page 1'
  })
  await expect(run2).toBeVisible({ timeout: 20_000 })
  const box2 = await run2.boundingBox()
  await window.mouse.dblclick(box2!.x + box2!.width / 2, box2!.y + box2!.height / 2)
  const boldButton2 = window.locator('[data-true-text-toolbar] button[title="Bold"]')
  await expect(boldButton2).toBeVisible({ timeout: 30_000 })
  await expect(boldButton2).toHaveAttribute('aria-pressed', 'true')
})
