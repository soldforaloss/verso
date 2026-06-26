import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('command palette opens, filters, and runs a command', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number] canvas').first()).toBeVisible({ timeout: 30_000 })

  // Ctrl+K opens the palette.
  await window.keyboard.press('Control+K')
  const input = window.getByPlaceholder('Type a command…')
  await expect(input).toBeVisible()

  // Filtering narrows to the shortcuts command; Enter runs the top match.
  await input.fill('keyboard')
  await window.keyboard.press('Enter')

  // The shortcuts cheat-sheet opens (the command ran) and the palette closed.
  await expect(window.getByText('Press ? anytime to open this list.')).toBeVisible({
    timeout: 10_000
  })
  await expect(input).toBeHidden()
})

test('does not leak global shortcuts to the document while open', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number] canvas').first()).toBeVisible({ timeout: 30_000 })

  await window.keyboard.press('Control+K')
  const input = window.getByPlaceholder('Type a command…')
  await expect(input).toBeVisible()

  // Ctrl+W (close tab) must be swallowed while the palette owns the keyboard.
  await window.keyboard.press('Control+W')
  await expect(input).toBeVisible()
  await expect(window.getByText('/ 8')).toBeVisible() // document still open

  // The same chord (Ctrl+K) still closes the palette.
  await window.keyboard.press('Control+K')
  await expect(input).toBeHidden()
})
