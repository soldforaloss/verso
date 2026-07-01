// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => process.cwd() }, dialog: {} }))
vi.mock('electron-log/main', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {} }
}))

import { sniffImageMime } from '../../src/main/files'

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_MAGIC = [0xff, 0xd8, 0xff]

describe('sniffImageMime', () => {
  it('recognizes a PNG by its 8-byte signature', () => {
    expect(sniffImageMime(new Uint8Array([...PNG_MAGIC, 0, 1, 2]))).toBe('image/png')
  })

  it('recognizes a JPEG by its SOI + marker prefix', () => {
    expect(sniffImageMime(new Uint8Array([...JPEG_MAGIC, 0xe0, 0x00]))).toBe('image/jpeg')
  })

  it('rejects anything else (extension is never trusted)', () => {
    // A PDF header, a GIF, and random/short buffers must all be refused.
    expect(sniffImageMime(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull() // %PDF
    expect(sniffImageMime(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull() // GIF8
    expect(sniffImageMime(new Uint8Array([0x89, 0x50]))).toBeNull() // truncated PNG
    expect(sniffImageMime(new Uint8Array([]))).toBeNull()
  })

  it('requires the full PNG signature, not just the first bytes', () => {
    const almost = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00])
    expect(sniffImageMime(almost)).toBeNull()
  })
})
