import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  loadSignatureFonts,
  renderTypedSignature,
  trimToContent,
  SIGNATURE_FONTS,
  SIGNATURE_INKS,
  type SignatureImage
} from '@/lib/signature'

const CANVAS_W = 540
const CANVAS_H = 200

export function SignatureDialog({
  open,
  onOpenChange,
  onInsert
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (image: SignatureImage) => void
}): React.JSX.Element {
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [ink, setInk] = useState<string>(SIGNATURE_INKS[0])
  const [typed, setTyped] = useState('')
  const [fontFamily, setFontFamily] = useState(SIGNATURE_FONTS[0]!.family)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!open) return
    void loadSignatureFonts()
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, CANVAS_W, CANVAS_H)
  }, [open, mode])

  const pointAt = (event: React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height
    }
  }

  const onPointerDown = (event: React.PointerEvent): void => {
    drawing.current = true
    last.current = pointAt(event)
    canvasRef.current?.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent): void => {
    if (!drawing.current || !last.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = pointAt(event)
    ctx.strokeStyle = ink
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }
  const onPointerUp = (): void => {
    drawing.current = false
    last.current = null
  }
  const clear = (): void => canvasRef.current?.getContext('2d')?.clearRect(0, 0, CANVAS_W, CANVAS_H)

  const insert = (): void => {
    const image =
      mode === 'draw'
        ? canvasRef.current
          ? trimToContent(canvasRef.current)
          : null
        : renderTypedSignature(typed, fontFamily, ink)
    if (!image) return
    onInsert(image)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a signature</DialogTitle>
          <DialogDescription>
            Draw or type a signature; it drops onto the page as an image you can move and resize.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <div className="flex items-center rounded-md border p-0.5">
            {(['draw', 'type'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-[5px] px-3 py-1 text-sm capitalize transition-colors',
                  mode === m ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent'
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {SIGNATURE_INKS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Ink ${color}`}
                onClick={() => setInk(color)}
                className={cn(
                  'size-5 rounded-full border',
                  ink === color ? 'ring-2 ring-ring ring-offset-1 ring-offset-background' : ''
                )}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>

        {mode === 'draw' ? (
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="h-44 w-full touch-none rounded-md border bg-white"
            />
            <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
              Sign above
            </span>
            <Button
              variant="ghost"
              size="icon"
              title="Clear"
              onClick={clear}
              className="absolute right-1 top-1"
            >
              <Eraser />
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Input
              autoFocus
              value={typed}
              placeholder="Type your name"
              onChange={(event) => setTyped(event.target.value)}
            />
            <div className="flex gap-1">
              {SIGNATURE_FONTS.map((font) => (
                <button
                  key={font.key}
                  type="button"
                  onClick={() => setFontFamily(font.family)}
                  className={cn(
                    'rounded-md border px-3 py-1 text-sm transition-colors',
                    fontFamily === font.family ? 'border-primary bg-accent' : 'hover:bg-accent'
                  )}
                >
                  {font.label}
                </button>
              ))}
            </div>
            <div className="flex h-28 items-center justify-center rounded-md border bg-white px-4">
              <span
                className="truncate text-5xl"
                style={{ fontFamily: `"${fontFamily}", cursive`, color: ink }}
              >
                {typed || 'Signature'}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={insert} disabled={mode === 'type' && typed.trim() === ''}>
            Insert signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
