import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { addNewFormFields } from '@/lib/pdfFormFields'

/**
 * Performance guard for the save pipeline at scale. The structural rebuild
 * (`buildFromModel`'s copy-pages + author edits + save) scales LINEARLY — ~0.4ms
 * per page locally, so a 1000-page rebuild is well under a second. The budget
 * here is deliberately generous (≈20× the observed time): it never flakes on a
 * slow CI runner for CPU-bound work, but a quadratic regression — which at this
 * size would be tens of seconds to minutes — blows straight past it.
 */
describe('save pipeline performance at scale', () => {
  it('rebuilds a 1000-page document well under budget (no O(n^2) cliff)', async () => {
    const source = await PDFDocument.create()
    for (let i = 0; i < 1000; i += 1) source.addPage([612, 792])
    const sourceBytes = await source.save()

    const start = Date.now()
    const loaded = await PDFDocument.load(sourceBytes, { updateMetadata: false })
    const out = await PDFDocument.create()
    const copied = await out.copyPages(loaded, loaded.getPageIndices())
    for (const page of copied) out.addPage(page)
    // Exercise the form-field path on the first page too.
    addNewFormFields(out.getForm(), out.getPages()[0]!, [
      { id: 'p', type: 'text', name: 'perf', rect: { x: 10, y: 10, width: 80, height: 16 } }
    ])
    const outBytes = await out.save()
    const elapsed = Date.now() - start

    expect(out.getPageCount()).toBe(1000)
    expect(outBytes.length).toBeGreaterThan(0)
    expect(elapsed, `1000-page rebuild took ${elapsed}ms`).toBeLessThan(10_000)
  })
})
