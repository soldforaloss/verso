// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument, degrees } from 'pdf-lib'

vi.mock('electron', () => ({ app: { getAppPath: () => process.cwd() } }))
vi.mock('electron-log/main', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {} }
}))

import { editImage, locateImage } from '../../src/main/pdfiumEdit'

// A 1×1 PNG, scaled to whatever rect it's drawn at.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

async function makeImagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  const png = await doc.embedPng(PNG)
  page.drawImage(png, { x: 100, y: 100, width: 80, height: 60 })
  return doc.save()
}

describe('PDFium in-place image editing', () => {
  let bytes: Uint8Array
  beforeEach(async () => {
    bytes = await makeImagePdf()
  })

  it('locates an image under a click and returns its rect', async () => {
    const hit = await locateImage({ bytes, pageIndex: 0, x: 140, y: 130 })
    expect(hit).not.toBeNull()
    expect(hit!.rect.x).toBeCloseTo(100, 0)
    expect(hit!.rect.y).toBeCloseTo(100, 0)
    expect(hit!.rect.width).toBeCloseTo(80, 0)
    expect(hit!.rect.height).toBeCloseTo(60, 0)
  })

  it('returns null when the click is not over an image', async () => {
    expect(await locateImage({ bytes, pageIndex: 0, x: 10, y: 10 })).toBeNull()
  })

  it('moves and resizes the image to a new rect', async () => {
    const edited = await editImage({
      bytes,
      pageIndex: 0,
      x: 140,
      y: 130,
      op: { kind: 'transform', rect: { x: 200, y: 50, width: 40, height: 30 } }
    })
    expect(edited).not.toBeNull()

    // The image is gone from its old spot and present at the new rect.
    expect(await locateImage({ bytes: edited!, pageIndex: 0, x: 140, y: 130 })).toBeNull()
    const moved = await locateImage({ bytes: edited!, pageIndex: 0, x: 220, y: 65 })
    expect(moved).not.toBeNull()
    expect(moved!.rect.x).toBeCloseTo(200, 0)
    expect(moved!.rect.width).toBeCloseTo(40, 0)
    expect(moved!.rect.height).toBeCloseTo(30, 0)
  })

  it('deletes the image', async () => {
    const edited = await editImage({ bytes, pageIndex: 0, x: 140, y: 130, op: { kind: 'delete' } })
    expect(edited).not.toBeNull()
    expect(await locateImage({ bytes: edited!, pageIndex: 0, x: 140, y: 130 })).toBeNull()
    // Still a valid, single-page PDF.
    expect((await PDFDocument.load(edited!)).getPageCount()).toBe(1)
  })

  it('leaves the original bytes unmodified (edit is pure)', async () => {
    const before = bytes.slice()
    await editImage({ bytes, pageIndex: 0, x: 140, y: 130, op: { kind: 'delete' } })
    expect(Array.from(bytes)).toEqual(Array.from(before))
  })

  it('returns null editing over empty space (caller does nothing)', async () => {
    expect(await editImage({ bytes, pageIndex: 0, x: 5, y: 5, op: { kind: 'delete' } })).toBeNull()
  })

  it('refuses an intrinsically rotated page', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([400, 300])
    const png = await doc.embedPng(PNG)
    page.drawImage(png, { x: 100, y: 100, width: 80, height: 60 })
    page.setRotation(degrees(90))
    const rotated = await doc.save()
    expect(await locateImage({ bytes: rotated, pageIndex: 0, x: 140, y: 130 })).toBeNull()
  })
})
