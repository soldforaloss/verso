import { describe, it, expect, beforeEach } from 'vitest'
import { useFormStore } from '@/store/formStore'

const reset = (): void => useFormStore.setState({ values: {}, hasFields: {} })

describe('formStore', () => {
  beforeEach(reset)

  it('stores and reads values per source/field', () => {
    const store = useFormStore.getState()
    store.setValue('srcA', 'name', 'Jane')
    store.setValue('srcA', 'agree', true)
    expect(useFormStore.getState().getValue('srcA', 'name')).toBe('Jane')
    expect(useFormStore.getState().getValue('srcA', 'agree')).toBe(true)
  })

  it('isolates values by source', () => {
    const store = useFormStore.getState()
    store.setValue('srcA', 'name', 'A')
    store.setValue('srcB', 'name', 'B')
    expect(useFormStore.getState().valuesForSource('srcA')).toEqual({ name: 'A' })
    expect(useFormStore.getState().valuesForSource('srcB')).toEqual({ name: 'B' })
  })

  it('resets only the given sources', () => {
    const store = useFormStore.getState()
    store.setValue('srcA', 'name', 'A')
    store.setValue('srcB', 'name', 'B')
    useFormStore.getState().resetSources(['srcA'])
    expect(useFormStore.getState().valuesForSource('srcA')).toEqual({})
    expect(useFormStore.getState().valuesForSource('srcB')).toEqual({ name: 'B' })
  })

  it('tracks which documents have fields', () => {
    useFormStore.getState().markHasFields('doc1')
    expect(useFormStore.getState().hasFields['doc1']).toBe(true)
    expect(useFormStore.getState().hasFields['doc2']).toBeUndefined()
  })
})
