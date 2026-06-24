import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSearchStore } from '@/store/searchStore'
import type { DocumentTab } from '@/store/documentStore'

/** Floating find-in-document bar with live results and next/prev navigation. */
export function SearchBar({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const query = useSearchStore((s) => s.query)
  const setQuery = useSearchStore((s) => s.setQuery)
  const run = useSearchStore((s) => s.run)
  const next = useSearchStore((s) => s.next)
  const prev = useSearchStore((s) => s.prev)
  const close = useSearchStore((s) => s.close)
  const matches = useSearchStore((s) => s.matches)
  const activeIndex = useSearchStore((s) => s.activeIndex)
  const status = useSearchStore((s) => s.status)
  const scannedPages = useSearchStore((s) => s.scannedPages)
  const totalPages = useSearchStore((s) => s.totalPages)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  // Search as the user types (debounced). Re-runs if the page model changes.
  useEffect(() => {
    const id = setTimeout(() => void run(tab), 300)
    return () => clearTimeout(id)
  }, [query, tab, run])

  const count = matches.length
  const label =
    status === 'searching'
      ? `Searching… ${scannedPages}/${totalPages}`
      : query.trim() === ''
        ? ''
        : count === 0
          ? 'No results'
          : `${activeIndex + 1} of ${count}`

  return (
    <div className="absolute right-4 top-3 z-20 flex items-center gap-1 rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-lg">
      <Input
        ref={inputRef}
        className="w-56"
        placeholder="Find in document"
        value={query}
        aria-label="Find in document"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (event.shiftKey) prev()
            else next()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
        }}
      />
      <span
        data-testid="search-status"
        className="min-w-24 px-1 text-center text-xs tabular-nums text-muted-foreground"
      >
        {label}
      </span>
      <Button
        variant="ghost"
        size="icon"
        title="Previous (Shift+Enter)"
        disabled={count === 0}
        onClick={prev}
      >
        <ChevronUp />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Next (Enter)"
        disabled={count === 0}
        onClick={next}
      >
        <ChevronDown />
      </Button>
      <Button variant="ghost" size="icon" title="Close (Esc)" onClick={close}>
        <X />
      </Button>
    </div>
  )
}
