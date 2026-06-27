import { describe, it, expect } from 'vitest'
import { diffWords } from '@/lib/textDiff'

describe('diffWords', () => {
  it('reports no changes for identical text', () => {
    const result = diffWords('the quick brown fox', 'the quick brown fox')
    expect(result.added).toBe(0)
    expect(result.removed).toBe(0)
    expect(result.runs).toEqual([{ type: 'same', text: 'the quick brown fox' }])
  })

  it('detects an inserted word', () => {
    const result = diffWords('the brown fox', 'the quick brown fox')
    expect(result.added).toBe(1)
    expect(result.removed).toBe(0)
    expect(result.runs).toEqual([
      { type: 'same', text: 'the' },
      { type: 'add', text: 'quick' },
      { type: 'same', text: 'brown fox' }
    ])
  })

  it('detects a removed word', () => {
    const result = diffWords('the quick brown fox', 'the brown fox')
    expect(result.removed).toBe(1)
    expect(result.added).toBe(0)
    expect(result.runs).toEqual([
      { type: 'same', text: 'the' },
      { type: 'remove', text: 'quick' },
      { type: 'same', text: 'brown fox' }
    ])
  })

  it('detects a replacement (remove + add)', () => {
    const result = diffWords('hello world', 'hello there')
    expect(result.removed).toBe(1)
    expect(result.added).toBe(1)
    expect(result.runs).toEqual([
      { type: 'same', text: 'hello' },
      { type: 'remove', text: 'world' },
      { type: 'add', text: 'there' }
    ])
  })

  it('normalizes whitespace and handles empty input', () => {
    expect(diffWords('  a   b ', 'a b').runs).toEqual([{ type: 'same', text: 'a b' }])
    expect(diffWords('', 'new words').runs).toEqual([{ type: 'add', text: 'new words' }])
    expect(diffWords('gone words', '').runs).toEqual([{ type: 'remove', text: 'gone words' }])
  })
})
