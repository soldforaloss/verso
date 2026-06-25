import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('editing a Calibri-class run substitutes the bundled metric-compatible font', async () => {
  app = await launchVerso()
  const window = await app.firstWindow()
  await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
    timeout: 30_000
  })

  // A PDF whose text is set in Carlito (the metric-compatible Calibri stand-in),
  // so PDF.js reports the font as "Carlito" and our matcher should pick it.
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const ttf = readFileSync(join(__dirname, '../../resources/fonts/Carlito-Regular.ttf'))
  const font = await doc.embedFont(ttf, { subset: false })
  const page = doc.addPage([460, 160])
  page.drawText('tommy.rush21@gmail.com', { x: 40, y: 90, size: 18, font })
  const base64 = Buffer.from(await doc.save()).toString('base64')

  await app.evaluate(({ BrowserWindow }, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const document = { id: globalThis.crypto.randomUUID(), name: 'calibri.pdf', path: null, bytes }
    BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
  }, base64)

  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })
  const run = window.locator('[data-page-number="1"] .textLayer span', { hasText: 'tommy.rush21' })
  await expect(run).toBeVisible({ timeout: 20_000 })

  await window.getByTitle('Edit existing text (cover & replace)').click()
  const box = await run.boundingBox()
  expect(box).not.toBeNull()
  await window.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

  const textarea = window.locator('textarea').first()
  await expect(textarea).toHaveValue(/tommy\.rush21/, { timeout: 10_000 })

  // The replacement renders in the bundled Carlito face (metric match), not a
  // generic fallback.
  await expect(textarea).toHaveCSS('font-family', /Carlito/)

  // Saving runs the real embed path (fetch the TTF, subset, draw) and must
  // produce a valid PDF.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-font-')), 'out.pdf')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, outPath)
  await window.keyboard.press('Control+Shift+S')
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
    .toBeGreaterThan(0)
  const saved = await PDFDocument.load(readFileSync(outPath))
  expect(saved.getPageCount()).toBe(1)
})
