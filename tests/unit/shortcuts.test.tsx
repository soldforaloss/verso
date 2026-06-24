import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ShortcutsDialog } from '@/features/help/ShortcutsDialog'
import { useUiStore } from '@/store/uiStore'

afterEach(() => {
  cleanup()
  useUiStore.setState({ shortcutsOpen: false })
})

describe('ShortcutsDialog', () => {
  it('is hidden until the store opens it', () => {
    render(<ShortcutsDialog />)
    expect(screen.queryByText('Keyboard shortcuts')).toBeNull()
  })

  it('lists shortcuts once opened', () => {
    useUiStore.setState({ shortcutsOpen: true })
    render(<ShortcutsDialog />)
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Open PDF')).toBeInTheDocument()
    expect(screen.getByText('Find in document')).toBeInTheDocument()
  })
})
