import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('single-key shortcuts switch markup tools (and not while typing)', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  const select = window.getByRole('button', { name: 'Select / edit (V)' })
  const highlight = window.getByRole('button', { name: 'Highlight text (H)' })
  const pencil = window.getByRole('button', { name: 'Freehand draw (P)' })

  // Select is the default tool.
  await expect(select).toHaveAttribute('aria-pressed', 'true')

  await window.keyboard.press('h')
  await expect(highlight).toHaveAttribute('aria-pressed', 'true')
  await expect(select).toHaveAttribute('aria-pressed', 'false')

  await window.keyboard.press('p')
  await expect(pencil).toHaveAttribute('aria-pressed', 'true')
  await expect(highlight).toHaveAttribute('aria-pressed', 'false')

  await window.keyboard.press('v')
  await expect(select).toHaveAttribute('aria-pressed', 'true')

  // Typing the same key in a text field must NOT switch tools.
  await window.getByLabel('Page number').click()
  await window.keyboard.press('h')
  await expect(highlight).toHaveAttribute('aria-pressed', 'false')
  await expect(select).toHaveAttribute('aria-pressed', 'true')
})
