import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useUiStore } from '@/store/uiStore'

interface Shortcut {
  keys: string[]
  label: string
}
interface Group {
  title: string
  shortcuts: Shortcut[]
}

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

const GROUPS: Group[] = [
  {
    title: 'File',
    shortcuts: [
      { keys: [MOD, 'O'], label: 'Open PDF' },
      { keys: [MOD, 'S'], label: 'Save' },
      { keys: [MOD, 'Shift', 'S'], label: 'Save As' },
      { keys: [MOD, 'W'], label: 'Close tab' }
    ]
  },
  {
    title: 'Edit',
    shortcuts: [
      { keys: [MOD, 'Z'], label: 'Undo' },
      { keys: [MOD, 'Shift', 'Z'], label: 'Redo' },
      { keys: [MOD, 'Y'], label: 'Redo' },
      { keys: ['Delete'], label: 'Delete selected annotation' },
      { keys: ['Esc'], label: 'Clear selection / close tool' }
    ]
  },
  {
    title: 'View & navigate',
    shortcuts: [
      { keys: [MOD, '+'], label: 'Zoom in' },
      { keys: [MOD, '-'], label: 'Zoom out' },
      { keys: [MOD, '0'], label: 'Fit width' },
      { keys: [MOD, 'Scroll'], label: 'Zoom at cursor' },
      { keys: [MOD, 'F'], label: 'Find in document' },
      { keys: ['F11'], label: 'Toggle fullscreen' }
    ]
  },
  {
    title: 'Help',
    shortcuts: [{ keys: ['?'], label: 'Show this cheat-sheet' }]
  }
]

function Key({ children }: { children: string }): React.JSX.Element {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
      {children}
    </kbd>
  )
}

export function ShortcutsDialog(): React.JSX.Element {
  const open = useUiStore((s) => s.shortcutsOpen)
  const setOpen = useUiStore((s) => s.setShortcutsOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Press ? anytime to open this list.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group.title} className="grid gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{group.title}</h3>
              <ul className="grid gap-1.5">
                {group.shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.label + shortcut.keys.join()}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{shortcut.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <Key key={key}>{key}</Key>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
