import { describe, it, expect } from 'vitest'
import {
  PingRequestSchema,
  PingResponseSchema,
  AppInfoSchema,
  EmptyRequestSchema,
  LocateTextRequestSchema,
  EditTextRequestSchema,
  EditImageRequestSchema,
  PickedImageSchema,
  SignPdfRequestSchema,
  VerifySignaturesRequestSchema
} from '@shared/ipc'

describe('IPC schemas', () => {
  describe('PingRequestSchema', () => {
    it('accepts a well-formed request', () => {
      const result = PingRequestSchema.safeParse({ message: 'hello' })
      expect(result.success).toBe(true)
    })

    it('rejects an empty message', () => {
      expect(PingRequestSchema.safeParse({ message: '' }).success).toBe(false)
    })

    it('rejects a missing message', () => {
      expect(PingRequestSchema.safeParse({}).success).toBe(false)
    })

    it('rejects a non-string message (the core security guarantee)', () => {
      expect(PingRequestSchema.safeParse({ message: 42 }).success).toBe(false)
    })

    it('rejects an over-long message', () => {
      expect(PingRequestSchema.safeParse({ message: 'x'.repeat(1001) }).success).toBe(false)
    })
  })

  describe('PingResponseSchema', () => {
    it('round-trips a valid response', () => {
      const value = { reply: 'pong: hi', receivedAt: 1_700_000_000_000 }
      expect(PingResponseSchema.parse(value)).toEqual(value)
    })

    it('rejects a negative timestamp', () => {
      expect(PingResponseSchema.safeParse({ reply: 'x', receivedAt: -1 }).success).toBe(false)
    })
  })

  describe('EmptyRequestSchema', () => {
    it('accepts undefined (no-arg channel)', () => {
      expect(EmptyRequestSchema.safeParse(undefined).success).toBe(true)
    })

    it('rejects a payload where none is expected', () => {
      expect(EmptyRequestSchema.safeParse({ unexpected: true }).success).toBe(false)
    })
  })

  describe('AppInfoSchema', () => {
    it('requires every version field', () => {
      const partial = { name: 'Verso', version: '0.1.0' }
      expect(AppInfoSchema.safeParse(partial).success).toBe(false)
    })
  })

  describe('LocateTextRequestSchema', () => {
    const ok = { bytes: new Uint8Array([1]), pageIndex: 0, x: 10, y: 20 }

    it('accepts a well-formed locate request', () => {
      expect(LocateTextRequestSchema.safeParse(ok).success).toBe(true)
    })

    it('rejects a negative or non-integer page index', () => {
      expect(LocateTextRequestSchema.safeParse({ ...ok, pageIndex: -1 }).success).toBe(false)
      expect(LocateTextRequestSchema.safeParse({ ...ok, pageIndex: 1.5 }).success).toBe(false)
    })

    it('rejects bytes that are not a Uint8Array (the trust-boundary guarantee)', () => {
      expect(LocateTextRequestSchema.safeParse({ ...ok, bytes: [1, 2, 3] }).success).toBe(false)
    })

    it('rejects non-finite or absurd coordinates / page indices', () => {
      expect(LocateTextRequestSchema.safeParse({ ...ok, x: Number.NaN }).success).toBe(false)
      expect(
        LocateTextRequestSchema.safeParse({ ...ok, y: Number.POSITIVE_INFINITY }).success
      ).toBe(false)
      expect(LocateTextRequestSchema.safeParse({ ...ok, pageIndex: 2_000_000 }).success).toBe(false)
    })
  })

  describe('EditTextRequestSchema', () => {
    const ok = { bytes: new Uint8Array([1]), pageIndex: 0, x: 1, y: 2, newText: 'hi' }

    it('accepts a well-formed edit request', () => {
      expect(EditTextRequestSchema.safeParse(ok).success).toBe(true)
    })

    it('accepts an empty replacement (clearing the text object)', () => {
      expect(EditTextRequestSchema.safeParse({ ...ok, newText: '' }).success).toBe(true)
    })

    it('rejects an absurdly long replacement', () => {
      expect(EditTextRequestSchema.safeParse({ ...ok, newText: 'x'.repeat(2001) }).success).toBe(
        false
      )
    })

    it('accepts an optional style block (size + colour + font bytes)', () => {
      const styled = {
        ...ok,
        style: { sizePt: 18, colorHex: '#1a2b3c', fontBytes: new Uint8Array([0, 1, 2]) }
      }
      expect(EditTextRequestSchema.safeParse(styled).success).toBe(true)
      // fontBytes is optional (size/colour-only edits omit it).
      expect(
        EditTextRequestSchema.safeParse({ ...ok, style: { sizePt: 12, colorHex: '#000000' } })
          .success
      ).toBe(true)
    })

    it('rejects a malformed style (bad colour, non-positive size)', () => {
      expect(
        EditTextRequestSchema.safeParse({ ...ok, style: { sizePt: 12, colorHex: 'red' } }).success
      ).toBe(false)
      expect(
        EditTextRequestSchema.safeParse({ ...ok, style: { sizePt: 0, colorHex: '#000000' } })
          .success
      ).toBe(false)
    })
  })

  describe('SignPdfRequestSchema', () => {
    const ok = { bytes: new Uint8Array([1]), passphrase: 'secret' }

    it('accepts a minimal request and optional metadata', () => {
      expect(SignPdfRequestSchema.safeParse(ok).success).toBe(true)
      expect(
        SignPdfRequestSchema.safeParse({ ...ok, reason: 'I approve', name: 'A', location: 'B' })
          .success
      ).toBe(true)
    })

    it('accepts an empty passphrase (some certificates have none)', () => {
      expect(SignPdfRequestSchema.safeParse({ ...ok, passphrase: '' }).success).toBe(true)
    })

    it('rejects an over-long passphrase or metadata field', () => {
      expect(SignPdfRequestSchema.safeParse({ ...ok, passphrase: 'x'.repeat(1025) }).success).toBe(
        false
      )
      expect(SignPdfRequestSchema.safeParse({ ...ok, reason: 'x'.repeat(257) }).success).toBe(false)
    })

    it('rejects bytes that are not a Uint8Array (the trust-boundary guarantee)', () => {
      expect(SignPdfRequestSchema.safeParse({ ...ok, bytes: 'notbytes' }).success).toBe(false)
    })
  })

  describe('VerifySignaturesRequestSchema', () => {
    it('accepts PDF bytes and rejects non-bytes', () => {
      expect(VerifySignaturesRequestSchema.safeParse({ bytes: new Uint8Array([1]) }).success).toBe(
        true
      )
      expect(VerifySignaturesRequestSchema.safeParse({ bytes: 'nope' }).success).toBe(false)
    })
  })

  describe('PickedImageSchema', () => {
    it('accepts PNG/JPEG bytes with an allowed mime', () => {
      expect(
        PickedImageSchema.safeParse({ bytes: new Uint8Array([1]), mime: 'image/png' }).success
      ).toBe(true)
      expect(
        PickedImageSchema.safeParse({ bytes: new Uint8Array([1]), mime: 'image/jpeg' }).success
      ).toBe(true)
    })

    it('rejects a disallowed mime and non-Uint8Array bytes', () => {
      expect(
        PickedImageSchema.safeParse({ bytes: new Uint8Array([1]), mime: 'image/gif' }).success
      ).toBe(false)
      expect(PickedImageSchema.safeParse({ bytes: [1, 2, 3], mime: 'image/png' }).success).toBe(
        false
      )
    })
  })

  describe('EditImageRequestSchema', () => {
    const base = { bytes: new Uint8Array([1]), pageIndex: 0, x: 10, y: 20 }

    it('accepts a transform op with a positive rect and a delete op', () => {
      expect(
        EditImageRequestSchema.safeParse({
          ...base,
          op: { kind: 'transform', rect: { x: 5, y: 5, width: 40, height: 30 } }
        }).success
      ).toBe(true)
      expect(EditImageRequestSchema.safeParse({ ...base, op: { kind: 'delete' } }).success).toBe(
        true
      )
    })

    it('rejects a non-positive or non-finite rect, and an unknown op', () => {
      expect(
        EditImageRequestSchema.safeParse({
          ...base,
          op: { kind: 'transform', rect: { x: 0, y: 0, width: 0, height: 10 } }
        }).success
      ).toBe(false)
      expect(EditImageRequestSchema.safeParse({ ...base, op: { kind: 'flip' } }).success).toBe(
        false
      )
    })
  })
})
