import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('exports the current page as a PNG image', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 20_000 })

  // Stub the save dialog to a temp PNG path.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-export-')), 'page.png')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, outPath)

  await window.getByTitle('Export (image or text)').click()
  await expect(window.getByText(/Render pages to a PNG\/JPEG image/)).toBeVisible()
  // PNG + current page are the defaults; export.
  await window.getByRole('button', { name: 'Export', exact: true }).click()

  // A valid PNG file (8-byte signature) appears at the chosen path.
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
    .toBeGreaterThan(8)
  const header = readFileSync(outPath).subarray(0, 8)
  expect([...header]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
})
