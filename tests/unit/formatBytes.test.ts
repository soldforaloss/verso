import { describe, expect, it } from 'vitest'
import { formatBytes } from '../../src/renderer/src/lib/utils'

describe('formatBytes', () => {
  it('shows raw bytes under 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('scales into KB / MB / GB with one decimal under 10', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB')
  })

  it('drops the decimal at 10 units and above', () => {
    expect(formatBytes(15 * 1024)).toBe('15 KB')
    expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB')
  })
})
