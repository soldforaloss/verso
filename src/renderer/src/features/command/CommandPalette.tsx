import { useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'
import { useDocumentStore } from '@/store/documentStore'
import { buildCommands, filterCommands, type Command } from '@/lib/commands'

/**
 * Command palette (Ctrl/⌘-K): a searchable list of every action, so nothing
 * hides behind a tool. Filter as you type; ↑/↓ to move, Enter to run.
 */
export function CommandPalette(): React.JSX.Element {
  const open = useUiStore((s) => s.commandPaletteOpen)
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen)
  const tab = useDocumentStore((s) => s.tabs.find((t) => t.id === s.activeId) ?? null)

  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const pointer = useRef({ x: -1, y: -1 })
  const listId = 'command-palette-list'
  const optionId = (i: number): string => `command-palette-option-${i}`

  const commands = useMemo(() => (open ? buildCommands(tab) : []), [open, tab])
  const filtered = useMemo(() => filterCommands(commands, query), [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
    }
  }, [open])
  useEffect(() => setIndex(0), [query])
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index, filtered])

  const run = (command: Command): void => {
    setOpen(false)
    command.run()
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const last = Math.max(filtered.length - 1, 0)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((i) => Math.min(i + 1, last))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const command = filtered[index]
      if (command) run(command)
    }
  }

  // Only react to *real* pointer movement, so the list auto-scrolling under a
  // stationary cursor doesn't hijack the keyboard selection.
  const onHover = (event: React.MouseEvent, i: number): void => {
    if (event.clientX === pointer.current.x && event.clientY === pointer.current.y) return
    pointer.current = { x: event.clientX, y: event.clientY }
    setIndex(i)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[18%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-background shadow-2xl focus:outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search and run a command.
          </DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              placeholder="Type a command…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={filtered[index] ? optionId(index) : undefined}
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul id={listId} ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matching commands
              </li>
            ) : (
              filtered.map((command, i) => (
                <li key={command.id} role="option" id={optionId(i)} aria-selected={i === index}>
                  <button
                    type="button"
                    tabIndex={-1}
                    data-active={i === index}
                    onMouseMove={(event) => onHover(event, i)}
                    onClick={() => run(command)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm',
                      i === index ? 'bg-accent text-accent-foreground' : ''
                    )}
                  >
                    <span>{command.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{command.group}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
