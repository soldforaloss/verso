/**
 * Tracks which windows the renderer has cleared for closing, so the window's
 * `close` handler can prompt about unsaved work once and then allow the close
 * after the user confirms. Keyed by `BrowserWindow.id`.
 */
const confirmed = new Set<number>()

/**
 * Set once the app is genuinely quitting (`before-quit`). The window-close guard
 * only intercepts a direct window close (the X / Alt+F4) — an explicit app quit
 * proceeds, which also lets test harnesses tear down gracefully.
 */
let quitting = false

export function markQuitting(): void {
  quitting = true
}

export function isQuitting(): boolean {
  return quitting
}

export function markCloseConfirmed(windowId: number): void {
  confirmed.add(windowId)
}

export function isCloseConfirmed(windowId: number): boolean {
  return confirmed.has(windowId)
}

export function clearCloseConfirmed(windowId: number): void {
  confirmed.delete(windowId)
}
