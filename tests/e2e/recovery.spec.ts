import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FIXTURE_PDF, MAIN_ENTRY } from './launch'

// Crash recovery needs the SAME userData across two launches, so don't use the
// throwaway-per-launch helper; share one dir.
const userData = mkdtempSync(join(tmpdir(), 'verso-recovery-'))
const apps: ElectronApplication[] = []

function launch(args: string[]): Promise<ElectronApplication> {
  return electron
    .launch({ args: [MAIN_ENTRY, ...args], env: { ...process.env, VERSO_USER_DATA: userData } })
    .then((app) => {
      apps.push(app)
      return app
    })
}

test.afterEach(async () => {
  await Promise.all(apps.map((app) => app.close().catch(() => {})))
  apps.length = 0
})

test('autosaves a dirty document and offers to recover it after a crash', async () => {
  test.setTimeout(120_000)

  // Session 1: open, make an unsaved edit, wait for the autosave snapshot.
  const app1 = await launch([FIXTURE_PDF])
  const w1 = await app1.firstWindow()
  const page1 = w1.locator('[data-page-number="1"]')
  await expect(page1.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await w1.keyboard.press('t')
  await page1.click({ position: { x: 200, y: 200 } })
  await expect(page1.locator('textarea')).toHaveCount(1)

  const recoveryDir = join(userData, 'recovery')
  await expect
    .poll(
      () => {
        try {
          return readdirSync(recoveryDir).filter((f) => f.endsWith('.pdf')).length
        } catch {
          return 0
        }
      },
      { timeout: 20_000 }
    )
    .toBeGreaterThan(0)

  // Simulate a crash: terminate without saving or cleanly closing the document.
  await app1.close()

  // Session 2: relaunch against the same userData — the recovery is offered.
  const app2 = await launch([])
  const w2 = await app2.firstWindow()
  await expect(w2.getByText('Recover unsaved changes?')).toBeVisible({ timeout: 30_000 })
  await w2.getByRole('button', { name: 'Restore' }).click()

  // The recovered document opens and renders.
  await expect(w2.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })
})
