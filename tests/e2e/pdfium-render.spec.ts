import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('Tier-3 PDFium renders the page when enabled (offline, under CSP)', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const canvas = window.locator('[data-page-number="1"] canvas')
  await expect(canvas).toBeVisible({ timeout: 30_000 })

  // Default backend is pdf.js.
  await expect(canvas).toHaveAttribute('data-render-backend', 'pdfjs')

  // Catch a CSP violation or PDFium load/render failure in the renderer console.
  const failures: string[] = []
  window.on('console', (msg) => {
    const text = msg.text()
    if (
      /content security policy|refused to (load|connect|execute|compile)|pdfium render failed|failed to load pdfium/i.test(
        text
      )
    ) {
      failures.push(text)
    }
  })

  // Enable the Tier-3 PDFium renderer via the command palette.
  await window.keyboard.press('Control+K')
  const input = window.getByPlaceholder('Type a command…')
  await expect(input).toBeVisible()
  await input.fill('PDFium')
  await window.keyboard.press('Enter')

  // The page re-renders through PDFium (wasm loaded offline from the app origin).
  await expect(canvas).toHaveAttribute('data-render-backend', 'pdfium', { timeout: 20_000 })
  // The PDFium-rendered canvas has real pixels (non-zero dimensions).
  expect(await canvas.evaluate((el: HTMLCanvasElement) => el.width)).toBeGreaterThan(0)

  expect(failures, `CSP/PDFium failures: ${failures.join(' | ')}`).toEqual([])
})
