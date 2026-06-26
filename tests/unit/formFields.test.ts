import { describe, it, expect } from 'vitest'
import { newFieldName, newFieldId } from '@/lib/formFields'

describe('formFields', () => {
  it('names fields by type with a unique suffix', () => {
    expect(newFieldName('text')).toMatch(/^Text_[0-9a-f]{8}$/)
    expect(newFieldName('checkbox')).toMatch(/^Checkbox_[0-9a-f]{8}$/)
  })

  it('generates distinct names and ids', () => {
    const names = new Set([
      newFieldName('text'),
      newFieldName('text'),
      newFieldName('text'),
      newFieldName('checkbox')
    ])
    expect(names.size).toBe(4)
    expect(newFieldId()).not.toBe(newFieldId())
  })
})
