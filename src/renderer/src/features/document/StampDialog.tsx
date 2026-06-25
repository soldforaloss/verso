import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { renderStamp, STAMP_PRESETS } from '@/lib/stamps'
import type { SignatureImage } from '@/lib/signature'

export function StampDialog({
  open,
  onOpenChange,
  onInsert
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (image: SignatureImage) => void
}): React.JSX.Element {
  const place = (text: string, color: string): void => {
    const image = renderStamp(text, color)
    if (!image) return
    onInsert(image)
    onOpenChange(false)
  }

  const dateLabel = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a stamp</DialogTitle>
          <DialogDescription>
            Drop a stamp onto the current page as a movable image; it flattens on save.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {STAMP_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => place(preset.label, preset.color)}
              className="flex items-center justify-center rounded-md border-2 px-3 py-2 text-sm font-bold tracking-wide transition-transform hover:scale-[1.02]"
              style={{ color: preset.color, borderColor: preset.color }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => place(dateLabel, '#1d4ed8')}
        >
          Date stamp — {dateLabel}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
