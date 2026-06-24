import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('thumbnail rail and full-text search work', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()

  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })

  // The sidebar is open by default and renders a thumbnail for page 1.
  await expect(window.locator('[data-thumb="1"] canvas')).toBeVisible({ timeout: 20_000 })

  // Open search and query text that appears once per page.
  await window.getByTitle('Find in document (Ctrl+F)').click()
  await window.getByPlaceholder('Find in document').fill('Verso sample page')

  // Each of the 8 pages has exactly one match (scoped to the search status).
  await expect(window.getByTestId('search-status')).toHaveText('1 of 8', { timeout: 15_000 })

  // Jumping to the next match advances the active result.
  await window.getByTitle('Next (Enter)').click()
  await expect(window.getByTestId('search-status')).toHaveText('2 of 8')
})
