import type { Annotation } from './annotations'

/**
 * A tiny in-memory clipboard for annotations (separate from the OS clipboard,
 * which carries text/images). Lets the user copy an annotation and paste clones
 * — including onto a different page. Lives for the session only.
 */
let copied: Annotation | null = null

export function copyAnnotation(annotation: Annotation): void {
  copied = annotation
}

export function getCopiedAnnotation(): Annotation | null {
  return copied
}
