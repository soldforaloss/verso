import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useToolStore } from '@/store/toolStore'
import { CALIBRATION_UNITS, type CalibrationUnit } from '@/lib/measure'

/**
 * Asks what real-world length a just-dragged calibration segment represents,
 * then activates that drawing scale for all subsequent measurements.
 */
export function CalibrateDialog({
  docId,
  paperPoints,
  onClose
}: {
  docId: string
  paperPoints: number
  onClose: () => void
}): React.JSX.Element {
  const setCalibration = useToolStore((s) => s.setMeasureCalibration)
  const setCalibrating = useToolStore((s) => s.setMeasureCalibrating)
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState<CalibrationUnit>('ft')

  const parsed = Number.parseFloat(value)
  const valid = Number.isFinite(parsed) && parsed > 0

  const apply = (): void => {
    if (!valid) return
    setCalibration(docId, { paperPoints, realValue: parsed, realUnit: unit })
    setCalibrating(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set drawing scale</DialogTitle>
          <DialogDescription>
            The distance you just drew ({(paperPoints / 72).toFixed(2)} in on paper) equals:
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            autoFocus
            type="number"
            min={0}
            step="any"
            aria-label="Real-world length"
            placeholder="10"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') apply()
            }}
            className="w-28"
          />
          <select
            aria-label="Real-world unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value as CalibrationUnit)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {CALIBRATION_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={apply}>
            Set scale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
