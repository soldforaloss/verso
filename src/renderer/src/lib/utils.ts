import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges class names with conflict resolution: `clsx` flattens conditional
 * class lists, `tailwind-merge` then dedupes conflicting Tailwind utilities
 * (e.g. `px-2 px-4` → `px-4`). The standard shadcn/ui `cn` helper.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Formats a byte count as a compact human-readable size (e.g. `1.4 MB`). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}
