import { useRef, useCallback } from 'react'

export function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't start a navigation swipe inside interactive regions like the map —
    // panning the map horizontally must not flip to the next stage.
    if ((e.target as HTMLElement).closest?.('[data-no-swipe]')) {
      startX.current = null
      startY.current = null
      return
    }
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (startX.current === null || startY.current === null) return
      const dx = e.changedTouches[0].clientX - startX.current
      const dy = e.changedTouches[0].clientY - startY.current
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx < 0) onSwipeLeft()
        else onSwipeRight()
      }
      startX.current = null
      startY.current = null
    },
    [onSwipeLeft, onSwipeRight],
  )

  return { onTouchStart, onTouchEnd }
}
