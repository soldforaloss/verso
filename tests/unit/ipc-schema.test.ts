import { describe, it, expect } from 'vitest'
import {
  PingRequestSchema,
  PingResponseSchema,
  AppInfoSchema,
  EmptyRequestSchema
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
})
