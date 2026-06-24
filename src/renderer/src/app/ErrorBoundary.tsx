import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Top-level error boundary. A render error in any feature shows a calm,
 * recoverable fallback (with the message and a reload) instead of a blank
 * window. Errors stay on the device — they are logged to the console only.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[verso] render error:', error, info.componentStack)
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <TriangleAlert className="size-10 text-destructive" />
        <div className="max-w-md space-y-1">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            Verso hit an unexpected error. Your files on disk are untouched.
          </p>
          <p className="break-words rounded bg-muted px-2 py-1 text-left font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={this.reset}>Try again</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload Verso
          </Button>
        </div>
      </div>
    )
  }
}
