import { test, expect, type ElectronApplication } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('editing merges the whole line, not just the clicked run', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
    timeout: 30_000
  })

  // Two separate runs on the same baseline (like a "city · phone" line).
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([460, 140])
  const first = 'Chandler, AZ'
  page.drawText(first, { x: 40, y: 80, size: 13, font })
  const gap = font.widthOfTextAtSize(`${first}  `, 13)
  page.drawText('(480) 310-0323', { x: 40 + gap, y: 80, size: 13, font })
  const base64 = Buffer.from(await doc.save()).toString('base64')

  await app.evaluate(({ BrowserWindow }, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const document = { id: globalThis.crypto.randomUUID(), name: 'line.pdf', path: null, bytes }
    BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
  }, base64)

  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })
  const run = window.locator('[data-page-number="1"] .textLayer span', { hasText: 'Chandler' })
  await expect(run).toBeVisible({ timeout: 20_000 })

  // Click the FIRST run only…
  await window.getByTitle('Edit existing text (cover & replace)').click()
  const box = await run.boundingBox()
  expect(box).not.toBeNull()
  await window.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

  // …but the editable box contains the whole line (both runs).
  await expect(window.locator('textarea').first()).toHaveValue(/Chandler, AZ.*480.*310-0323/, {
    timeout: 10_000
  })
})
