/**
 * Editable document outline (bookmarks). A tree of items, each anchored to a
 * page's stable `PageRef.key` (not a logical/source index), so bookmarks survive
 * page reorder/delete. The destination page is resolved from the key at
 * navigation and save time. Pure transforms here are the single source of truth
 * for the editor and are unit-tested; nothing here touches PDF.js or pdf-lib.
 */
export interface OutlineItem {
  id: string
  title: string
  /** Target page's stable key, or null for a non-navigating header item. */
  pageKey: string | null
  children: OutlineItem[]
  expanded: boolean
}

export function newOutlineId(): string {
  return crypto.randomUUID()
}

/** Builds a fresh top-level bookmark for a page. */
export function makeOutlineItem(title: string, pageKey: string | null): OutlineItem {
  return { id: newOutlineId(), title, pageKey, children: [], expanded: true }
}

/** Renames the item with `id` (deep). */
export function renameItem(items: OutlineItem[], id: string, title: string): OutlineItem[] {
  return items.map((item) =>
    item.id === id
      ? { ...item, title }
      : { ...item, children: renameItem(item.children, id, title) }
  )
}

/** Removes the item with `id` (and its subtree) anywhere in the tree. */
export function deleteItem(items: OutlineItem[], id: string): OutlineItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ({ ...item, children: deleteItem(item.children, id) }))
}

/** Appends a new top-level bookmark. */
export function appendItem(items: OutlineItem[], item: OutlineItem): OutlineItem[] {
  return [...items, item]
}

/** Moves the item up (-1) or down (+1) within its sibling list. No-op at edges. */
export function moveItem(items: OutlineItem[], id: string, direction: -1 | 1): OutlineItem[] {
  const index = items.findIndex((item) => item.id === id)
  if (index !== -1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return items
    const next = items.slice()
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    return next
  }
  return items.map((item) => ({ ...item, children: moveItem(item.children, id, direction) }))
}

/** Demotes the item to be a child of its previous sibling. No-op for a first child. */
export function indentItem(items: OutlineItem[], id: string): OutlineItem[] {
  const index = items.findIndex((item) => item.id === id)
  if (index > 0) {
    const item = items[index]!
    const previous = items[index - 1]!
    const newPrevious: OutlineItem = {
      ...previous,
      expanded: true,
      children: [...previous.children, item]
    }
    return [...items.slice(0, index - 1), newPrevious, ...items.slice(index + 1)]
  }
  if (index === 0) return items
  return items.map((item) => ({ ...item, children: indentItem(item.children, id) }))
}

/** Promotes the item to sit after its parent at the parent's level. */
export function outdentItem(items: OutlineItem[], id: string): OutlineItem[] {
  const result: OutlineItem[] = []
  let done = false
  for (const item of items) {
    if (done) {
      result.push(item)
      continue
    }
    const childIndex = item.children.findIndex((child) => child.id === id)
    if (childIndex !== -1) {
      const child = item.children[childIndex]!
      result.push({ ...item, children: item.children.filter((_, i) => i !== childIndex) })
      result.push(child)
      done = true
    } else {
      const recursed = outdentItem(item.children, id)
      result.push(recursed === item.children ? item : { ...item, children: recursed })
    }
  }
  return result
}

/** True if `id` exists at the top level (cannot be outdented / is a root item). */
export function isTopLevel(items: OutlineItem[], id: string): boolean {
  return items.some((item) => item.id === id)
}

/**
 * Number of items visible in the tree given each item's expanded state — the
 * positive `/Count` for the `/Outlines` root and for any open parent item.
 */
export function countVisible(items: OutlineItem[]): number {
  let total = 0
  for (const item of items) {
    total += 1
    if (item.expanded && item.children.length > 0) total += countVisible(item.children)
  }
  return total
}
