import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { join } from 'node:path'

const MAIN_ENTRY = join(__dirname, '../../out/main/index.js')
const FIXTURE = join(__dirname, '../fixtures/sample.pdf')

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('opens a PDF from the command line, renders it, and exposes selectable text', async () => {
  app = await electron.launch({ args: [MAIN_ENTRY, FIXTURE] })
  const window = await app.firstWindow()

  // The toolbar shows the page count once the document is loaded.
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })

  // The first page paints to a canvas.
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 20_000 })

  // The text layer carries the (selectable) page text.
  await expect(window.locator('.textLayer').first()).toContainText('Verso sample page 1', {
    timeout: 20_000
  })

  // Switching to single-page layout keeps the document visible.
  await window.getByTitle('Single page').click()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible()
})
