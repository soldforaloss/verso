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
