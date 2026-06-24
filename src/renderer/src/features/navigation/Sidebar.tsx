import { useState } from 'react'
import { Images, ListTree } from 'lucide-react'
import type { DocumentTab } from '@/store/documentStore'
import { cn } from '@/lib/utils'
import { Thumbnails } from './Thumbnails'
import { Outline } from './Outline'

type Panel = 'thumbnails' | 'outline'

const PANELS: { id: Panel; label: string; Icon: typeof Images }[] = [
  { id: 'thumbnails', label: 'Thumbnails', Icon: Images },
  { id: 'outline', label: 'Outline', Icon: ListTree }
]

/** Left navigation rail with Thumbnails and Outline panels. */
export function Sidebar({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const [panel, setPanel] = useState<Panel>('thumbnails')

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
      <div className="flex border-b">
        {PANELS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-selected={panel === id}
            onClick={() => setPanel(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium',
              panel === id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {panel === 'thumbnails' ? <Thumbnails tab={tab} /> : <Outline tab={tab} />}
      </div>
    </aside>
  )
}
