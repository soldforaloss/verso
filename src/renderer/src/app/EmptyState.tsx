import { useEffect, useState } from 'react'
import { Clock, FileText, FolderOpen, Moon, Sun, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openPath, openViaDialog } from '@/lib/open'
import { usePreferencesStore } from '@/store/preferencesStore'
import type { RecentFile } from '@shared/ipc'

/** Landing screen shown when no document is open: open action + recent files. */
export function EmptyState(): React.JSX.Element {
  const [recent, setRecent] = useState<RecentFile[]>([])
  const theme = usePreferencesStore((s) => s.theme)
  const toggleTheme = usePreferencesStore((s) => s.toggleTheme)

  useEffect(() => {
    void window.api.getRecentFiles().then(setRecent)
  }, [])

  const clearRecent = async (): Promise<void> => {
    await window.api.clearRecentFiles()
    setRecent([])
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center p-8">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4"
        title="Toggle theme"
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Sun /> : <Moon />}
      </Button>

      <div className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <FileText className="size-8" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Verso</h1>
      <p className="mt-1 text-sm text-muted-foreground">A calm place to read and edit PDFs.</p>

      <Button className="mt-6" onClick={() => void openViaDialog()}>
        <FolderOpen />
        Open PDF
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        …or drag a PDF anywhere onto this window.
      </p>

      {recent.length > 0 && (
        <div className="mt-10 w-full max-w-md">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Clock className="size-3.5" /> Recent
            </span>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => void clearRecent()}
            >
              <Trash2 className="size-3" /> Clear
            </button>
          </div>
          <ul className="divide-y rounded-lg border">
            {recent.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                  title={file.path}
                  onClick={() => void openPath(file.path)}
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 truncate text-xs text-muted-foreground">
                    {file.path}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
