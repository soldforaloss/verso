import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('opens a PDF from the command line, renders it, and exposes selectable text', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()

  // The toolbar shows the page count once the document is loaded.
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })

  // The first page paints to a canvas.
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 20_000 })

  // The text layer carries the (selectable) page text.
  await expect(window.locator('.textLayer').first()).toContainText('Verso sample page 1', {
    timeout: 20_000
  })

  // Switching to single-page layout keeps the (current) page visible.
  await window.getByTitle('Single page').click()
  await expect(window.locator('[data-page-number] canvas').first()).toBeVisible({ timeout: 20_000 })
})
