import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

/** The URIs of every /Link annotation on page 1 of a saved PDF. */
function linkUris(doc: PDFDocument): string[] {
  const annots = doc.getPage(0).node.Annots()
  if (!annots) return []
  const uris: string[] = []
  for (let i = 0; i < annots.size(); i += 1) {
    const dict = annots.lookup(i, PDFDict)
    if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Link')) continue
    const action = dict.lookup(PDFName.of('A'), PDFDict)
    const uri = action.lookup(PDFName.of('URI'))
    if (uri instanceof PDFString || uri instanceof PDFHexString) uris.push(uri.decodeText())
  }
  return uris
}

async function saveTo(
  app: ElectronApplication,
  window: Awaited<ReturnType<ElectronApplication['firstWindow']>>
): Promise<string> {
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-link-')), 'out.pdf')
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
  return outPath
}

test('author a hyperlink and write it as a clickable /Link annotation on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const page1 = window.locator('[data-page-number="1"]')
  await expect(page1.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Pick the link tool and drag a hotspot rectangle.
  await window.getByTitle('Add link (clickable hyperlink)').click()
  const box = await page1.boundingBox()
  if (!box) throw new Error('page has no bounding box')
  await window.mouse.move(box.x + 90, box.y + 120)
  await window.mouse.down()
  await window.mouse.move(box.x + 260, box.y + 150, { steps: 6 })
  await window.mouse.up()

  // The URL editor opens automatically; type an address and commit.
  const url = window.getByLabel('Link URL')
  await url.fill('https://verso.example/docs')
  await url.press('Enter')
  await expect(page1.getByText('https://verso.example/docs')).toBeVisible()

  const doc = await PDFDocument.load(readFileSync(await saveTo(app, window)))
  expect(linkUris(doc)).toContain('https://verso.example/docs')
})

test('a javascript: URL is never written into the saved PDF', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const page1 = window.locator('[data-page-number="1"]')
  await expect(page1.locator('canvas')).toBeVisible({ timeout: 30_000 })

  await window.getByTitle('Add link (clickable hyperlink)').click()
  const box = await page1.boundingBox()
  if (!box) throw new Error('page has no bounding box')
  await window.mouse.move(box.x + 90, box.y + 200)
  await window.mouse.down()
  await window.mouse.move(box.x + 260, box.y + 230, { steps: 6 })
  await window.mouse.up()

  const url = window.getByLabel('Link URL')
  await url.fill('javascript:alert(1)')
  await url.press('Enter')

  // The saved PDF must contain no /Link annotation for the rejected URL.
  const doc = await PDFDocument.load(readFileSync(await saveTo(app, window)))
  expect(linkUris(doc)).toEqual([])
})
