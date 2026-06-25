import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

async function selectFirstRun(window: Awaited<ReturnType<ElectronApplication['firstWindow']>>) {
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })
  const run = window.locator('[data-page-number="1"] .textLayer span', {
    hasText: 'Verso sample page 1'
  })
  await expect(run).toBeVisible({ timeout: 20_000 })
  await run.selectText()
  return run
}

test('selecting text raises a popover that starts editing the run', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await selectFirstRun(window)

  const edit = window.getByTitle('Edit text', { exact: true })
  await expect(edit).toBeVisible({ timeout: 10_000 })
  await edit.click()

  // Editing begins directly from the selection — no tool switch needed.
  await expect(window.locator('textarea').first()).toHaveValue(/Verso sample page 1/, {
    timeout: 10_000
  })
})

test('selecting text can highlight it straight from the popover', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await selectFirstRun(window)

  await window.getByTitle('Highlight', { exact: true }).click()
  // The highlight annotation was committed, so undo is available.
  await expect(window.getByTitle('Undo (Ctrl+Z)')).toBeEnabled({ timeout: 10_000 })
})
