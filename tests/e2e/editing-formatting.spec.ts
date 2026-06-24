import { test, expect, type ElectronApplication } from '@playwright/test'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('cover-&-replace keeps the original text color and size', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
    timeout: 30_000
  })

  // A PDF whose only text is a large BLUE word.
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([420, 200])
  page.drawText('CONTACT', { x: 40, y: 110, size: 30, font, color: rgb(0.1, 0.2, 0.82) })
  const base64 = Buffer.from(await doc.save()).toString('base64')

  await app.evaluate(({ BrowserWindow }, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const document = { id: globalThis.crypto.randomUUID(), name: 'blue.pdf', path: null, bytes }
    BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
  }, base64)

  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })
  const run = window.locator('[data-page-number="1"] .textLayer span', { hasText: 'CONTACT' })
  await expect(run).toBeVisible({ timeout: 20_000 })

  // Edit the run with the cover-&-replace tool.
  await window.getByTitle('Edit existing text (cover & replace)').click()
  const box = await run.boundingBox()
  expect(box).not.toBeNull()
  await window.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

  const textarea = window.locator('textarea').first()
  await expect(textarea).toHaveValue(/CONTACT/, { timeout: 10_000 })

  // The replacement inherits the original blue (not the old hardcoded black).
  const [r, g, b] = await textarea.evaluate((el) =>
    getComputedStyle(el).color.match(/\d+/g)!.map(Number)
  )
  expect(b).toBeGreaterThan(r) // blue-dominant
  expect(b).toBeGreaterThan(g)
  expect(b).toBeGreaterThan(90) // clearly not black/near-black

  // …and keeps a comparable font size (≈30px, not a default tiny size).
  const fontSize = await textarea.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(fontSize).toBeGreaterThanOrEqual(20)
})
