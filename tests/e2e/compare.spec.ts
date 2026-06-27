import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('compares the document against another PDF (identical = no changes)', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Pick the same fixture as the comparison target.
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, FIXTURE_PDF)
  await window.getByTitle('Compare with another PDF').click()

  // The compare view opens and reports no changes (identical inputs).
  await expect(window.getByTestId('compare-changed')).toHaveText('No changes', { timeout: 20_000 })

  // The text-diff mode also reports no changes against the same document.
  await window.getByRole('button', { name: 'text', exact: true }).click()
  await expect(window.getByTestId('compare-changed')).toHaveText('No text changes', {
    timeout: 20_000
  })
  await expect(window.getByTestId('compare-text')).toBeVisible()

  // Escape closes the overlay (it owns the keyboard while open).
  await window.keyboard.press('Escape')
  await expect(window.getByTestId('compare-changed')).toBeHidden()
})
