import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders its label', () => {
    render(<Button>Open file</Button>)
    expect(screen.getByRole('button', { name: 'Open file' })).toBeInTheDocument()
  })

  it('applies destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-destructive')
  })

  it('fires onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Click' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled when the disabled prop is set', () => {
    render(<Button disabled>Nope</Button>)
    expect(screen.getByRole('button', { name: 'Nope' })).toBeDisabled()
  })

  it('renders as a child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="https://versoeditor.com">Website</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Website' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'https://versoeditor.com')
  })
})
