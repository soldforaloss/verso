/**
 * Renders a page-number / Bates label from a template. Two tokens are replaced:
 * `{n}` → the running number (optionally zero-padded to `digits`) and `{total}`
 * → the page count. Kept dependency-free so it is trivially unit-testable.
 *
 * Examples: `"{n}"` (plain), `"Page {n} of {total}"`, `"ACME-{n}"` with
 * `digits: 6` → `"ACME-000001"`.
 */
export function formatPageLabel(
  format: string,
  index: number,
  start: number,
  total: number,
  digits: number
): string {
  const num = start + index
  const nStr = digits > 0 ? String(num).padStart(digits, '0') : String(num)
  return format.replace(/\{n\}/g, nStr).replace(/\{total\}/g, String(total))
}
