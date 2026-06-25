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

// Each case sets text in a bundled font, so PDF.js reports that font and the
// matcher should substitute the same bundled face when editing.
const CASES = [
  { ttf: 'Carlito-Regular', family: /Carlito/, marker: 'tommy.rush21' }, // ≈ Calibri
  { ttf: 'LiberationSans-Regular', family: /Liberation Sans/, marker: 'Engineer' } // ≈ Arial
]

for (const { ttf, family, marker } of CASES) {
  test(`editing ${ttf} text substitutes the bundled font and saves`, async () => {
    app = await launchVerso()
    const window = await app.firstWindow()
    await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
      timeout: 30_000
    })

    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)
    const bytes = readFileSync(join(__dirname, `../../resources/fonts/${ttf}.ttf`))
    const font = await doc.embedFont(bytes, { subset: false })
    const page = doc.addPage([460, 160])
    page.drawText(`${marker} Lead 2026`, { x: 40, y: 90, size: 18, font })
    const base64 = Buffer.from(await doc.save()).toString('base64')

    await app.evaluate(({ BrowserWindow }, b64: string) => {
      const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const document = {
        id: globalThis.crypto.randomUUID(),
        name: 'doc.pdf',
        path: null,
        bytes: data
      }
      BrowserWindow.getAllWindows()[0]!.webContents.send('app:open-file-event', document)
    }, base64)

    await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })
    const run = window.locator('[data-page-number="1"] .textLayer span', { hasText: marker })
    await expect(run).toBeVisible({ timeout: 20_000 })

    await window.getByTitle('Edit existing text (cover & replace)').click()
    const box = await run.boundingBox()
    expect(box).not.toBeNull()
    await window.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

    const textarea = window.locator('textarea').first()
    await expect(textarea).toHaveValue(new RegExp(marker), { timeout: 10_000 })
    await expect(textarea).toHaveCSS('font-family', family)

    // The embed-on-save path runs and yields a valid PDF.
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
    expect((await PDFDocument.load(readFileSync(outPath))).getPageCount()).toBe(1)
  })
}
