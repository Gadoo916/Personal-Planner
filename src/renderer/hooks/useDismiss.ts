import { useEffect } from 'react'

/**
 * Closes an anchored popover on Escape or a pointer press outside it. Both
 * pickers need this, and neither of them is a modal, so nothing is trapped and
 * nothing is announced as a dialog that blocks the page.
 */
export function useDismiss(
  open: boolean,
  container: React.RefObject<HTMLElement | null>,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!open) return

    function handlePointer(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) onDismiss()
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, container, onDismiss])
}
