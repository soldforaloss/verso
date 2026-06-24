import { describe, it, expect, beforeEach } from 'vitest'
import { useHistoryStore, selectCanUndo, selectCanRedo, type Command } from '@/store/historyStore'

const DOC = 'doc-1'

/** A command that sets a shared value, capturing the previous one for undo. */
function setValueCommand(ref: { value: number }, to: number): Command {
  let from = ref.value
  return {
    label: `set ${to}`,
    redo: () => {
      from = ref.value
      ref.value = to
    },
    undo: () => {
      ref.value = from
    }
  }
}

describe('historyStore', () => {
  beforeEach(() => useHistoryStore.setState({ histories: {} }))

  it('executes a command immediately and enables undo', () => {
    const ref = { value: 0 }
    useHistoryStore.getState().execute(DOC, setValueCommand(ref, 5))
    expect(ref.value).toBe(5)
    expect(selectCanUndo(DOC)(useHistoryStore.getState())).toBe(true)
    expect(selectCanRedo(DOC)(useHistoryStore.getState())).toBe(false)
  })

  it('undoes and redoes', () => {
    const ref = { value: 0 }
    const history = useHistoryStore.getState()
    history.execute(DOC, setValueCommand(ref, 5))
    history.execute(DOC, setValueCommand(ref, 9))
    expect(ref.value).toBe(9)

    history.undo(DOC)
    expect(ref.value).toBe(5)
    history.undo(DOC)
    expect(ref.value).toBe(0)
    expect(selectCanUndo(DOC)(useHistoryStore.getState())).toBe(false)

    history.redo(DOC)
    expect(ref.value).toBe(5)
    history.redo(DOC)
    expect(ref.value).toBe(9)
  })

  it('clears the redo stack when a new command is executed', () => {
    const ref = { value: 0 }
    const history = useHistoryStore.getState()
    history.execute(DOC, setValueCommand(ref, 5))
    history.undo(DOC)
    history.execute(DOC, setValueCommand(ref, 7))
    expect(selectCanRedo(DOC)(useHistoryStore.getState())).toBe(false)
    expect(ref.value).toBe(7)
  })

  it('keeps per-document stacks isolated and forgets on demand', () => {
    const a = { value: 0 }
    const history = useHistoryStore.getState()
    history.execute('a', setValueCommand(a, 1))
    expect(selectCanUndo('a')(useHistoryStore.getState())).toBe(true)
    expect(selectCanUndo('b')(useHistoryStore.getState())).toBe(false)
    history.forget('a')
    expect(selectCanUndo('a')(useHistoryStore.getState())).toBe(false)
  })
})
