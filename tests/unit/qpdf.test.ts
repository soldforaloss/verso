import { describe, expect, it } from 'vitest'
import { buildQpdfArgs } from '../../src/main/qpdfArgs'
import { TransformPdfRequestSchema } from '@shared/ipc'

const IN = '/tmp/in.pdf'
const OUT = '/tmp/out.pdf'
const bytes = new Uint8Array([1, 2, 3])

describe('buildQpdfArgs', () => {
  it('builds a 256-bit encrypt command with permission flags', () => {
    const args = buildQpdfArgs(
      {
        operation: 'encrypt',
        bytes,
        userPassword: 'open',
        ownerPassword: 'owner',
        permissions: { printing: true, modifying: false, copying: false, annotating: true }
      },
      IN,
      OUT
    )
    expect(args.slice(0, 4)).toEqual(['--encrypt', 'open', 'owner', '256'])
    expect(args).toContain('--print=full')
    expect(args).toContain('--modify=none')
    expect(args).toContain('--extract=n')
    expect(args).toContain('--annotate=y')
    // Input/output come after the `--` separator, in order.
    expect(args.slice(-3)).toEqual(['--', IN, OUT])
  })

  it('passes the password as a single --password= token on decrypt', () => {
    const args = buildQpdfArgs({ operation: 'decrypt', bytes, password: 'sec ret' }, IN, OUT)
    expect(args).toEqual(['--decrypt', '--password=sec ret', IN, OUT])
  })

  it('repairs by plain rewrite and linearizes with --linearize', () => {
    expect(buildQpdfArgs({ operation: 'repair', bytes }, IN, OUT)).toEqual([IN, OUT])
    expect(buildQpdfArgs({ operation: 'linearize', bytes }, IN, OUT)).toEqual([
      '--linearize',
      IN,
      OUT
    ])
  })

  it('optimizes with object streams + max-effort flate recompression', () => {
    const args = buildQpdfArgs({ operation: 'optimize', bytes }, IN, OUT)
    expect(args).toEqual([
      '--object-streams=generate',
      '--compress-streams=y',
      '--recompress-flate',
      '--compression-level=9',
      '--',
      IN,
      OUT
    ])
    // Input/output come after the `--` separator so a path can't be read as a flag.
    expect(args.slice(-3)).toEqual(['--', IN, OUT])
    // No image-touching flags — structural recompression must never re-encode images.
    expect(args.some((a) => a.includes('image'))).toBe(false)
  })
})

describe('TransformPdfRequestSchema', () => {
  it('accepts a valid encrypt request', () => {
    const result = TransformPdfRequestSchema.safeParse({
      operation: 'encrypt',
      bytes,
      userPassword: '',
      ownerPassword: 'owner',
      permissions: { printing: true, modifying: true, copying: true, annotating: true }
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid optimize request', () => {
    expect(TransformPdfRequestSchema.safeParse({ operation: 'optimize', bytes }).success).toBe(true)
  })

  it('rejects an unknown operation', () => {
    expect(TransformPdfRequestSchema.safeParse({ operation: 'shred', bytes }).success).toBe(false)
  })

  it('rejects non-Uint8Array bytes (the trust-boundary guarantee)', () => {
    expect(
      TransformPdfRequestSchema.safeParse({ operation: 'repair', bytes: [1, 2, 3] }).success
    ).toBe(false)
  })
})
