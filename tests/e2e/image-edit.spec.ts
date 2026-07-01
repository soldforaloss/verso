import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

async function makeImagePdfPath(): Promise<string> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  const png = await doc.embedPng(PNG)
  // Cover most of the page so a click near centre reliably hits the image.
  page.drawImage(png, { x: 40, y: 40, width: 320, height: 220 })
  const dir = mkdtempSync(join(tmpdir(), 'verso-img-'))
  const path = join(dir, 'image.pdf')
  writeFileSync(path, await doc.save())
  return path
}

test('selects an image and deletes it from the content stream', async () => {
  const path = await makeImagePdfPath()
  app = await launchVerso([path])
  const window = await app.firstWindow()
  const canvas = window.locator('[data-page-number="1"] canvas')
  await expect(canvas).toBeVisible({ timeout: 30_000 })

  // Activate the Edit-image tool and click the image.
  await window.getByTitle('Edit image (move, resize, delete)').click()
  const box = (await canvas.boundingBox())!
  await window.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

  // A selection appears with a delete affordance.
  const trash = window.getByTitle('Delete image')
  await expect(trash).toBeVisible({ timeout: 15_000 })

  // Delete it → the document becomes dirty and the image is removed.
  await trash.click()
  await expect(window.locator('[title="Unsaved changes"]')).toBeVisible({ timeout: 20_000 })

  // Clicking where the image was no longer selects anything — it's gone.
  await window.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await window.waitForTimeout(1500)
  await expect(window.getByTitle('Delete image')).toHaveCount(0)
})

test('Backspace while typing in a field does not delete the selected image', async () => {
  const path = await makeImagePdfPath()
  app = await launchVerso([path])
  const window = await app.firstWindow()
  const canvas = window.locator('[data-page-number="1"] canvas')
  await expect(canvas).toBeVisible({ timeout: 30_000 })

  await window.getByTitle('Edit image (move, resize, delete)').click()
  const box = (await canvas.boundingBox())!
  await window.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(window.getByTitle('Delete image')).toBeVisible({ timeout: 15_000 })

  // Focus a toolbar text input and press Backspace to edit its value. The
  // image-edit layer must NOT hijack that keystroke to delete the image.
  await window.getByLabel('Page number').focus()
  await window.keyboard.press('Backspace')
  await window.waitForTimeout(500)

  // The image is still selected and the document was never dirtied.
  await expect(window.getByTitle('Delete image')).toBeVisible()
  await expect(window.locator('[title="Unsaved changes"]')).toHaveCount(0)
})
