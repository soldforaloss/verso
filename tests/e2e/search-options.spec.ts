import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

// The fixture's pages read "Verso sample page N" and "… Page N of 8.", so the
// strings "PAGE" (all caps) and "ampl" (inside "sample") only match with the
// right option turned off — a deterministic probe for the toggles.
test('match-case and whole-word toggles change the results', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number] canvas').first()).toBeVisible({ timeout: 30_000 })

  await window.keyboard.press('Control+F')
  const input = window.getByLabel('Find in document')
  await expect(input).toBeVisible()
  const status = window.getByTestId('search-status')

  // Case-insensitive: "PAGE" matches "page"/"Page".
  await input.fill('PAGE')
  await expect(status).toContainText('of', { timeout: 10_000 })

  // Match case on: all-caps "PAGE" appears nowhere.
  await window.getByLabel('Match case').click()
  await expect(status).toHaveText('No results', { timeout: 10_000 })

  // Back off → matches return.
  await window.getByLabel('Match case').click()
  await expect(status).toContainText('of', { timeout: 10_000 })

  // Whole-word: "ampl" matches as a substring of "sample"…
  await input.fill('ampl')
  await expect(status).toContainText('of', { timeout: 10_000 })
  // …but never as a whole word.
  await window.getByLabel('Whole word').click()
  await expect(status).toHaveText('No results', { timeout: 10_000 })
})
