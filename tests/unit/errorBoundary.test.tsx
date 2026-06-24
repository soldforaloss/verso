import { describe, expect, it, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '@/app/ErrorBoundary'

afterEach(cleanup)

function Boom(): React.JSX.Element {
  throw new Error('kaboom')
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows a recoverable fallback with the error message when a child throws', () => {
    // Silence the expected React error logging for this case.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('kaboom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload Verso' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    spy.mockRestore()
  })
})
