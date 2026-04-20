/**
 * usePullToRefresh.ts
 * Detects pull-down gesture on mobile and triggers a refresh callback.
 */

import { useEffect, useRef, useState } from 'react'

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const THRESHOLD = 80

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === 0) return
      const diff = e.touches[0].clientY - startY.current
      if (diff > 20 && window.scrollY === 0) {
        setPulling(true)
      }
    }

    async function onTouchEnd() {
      const diff = startY.current
      startY.current = 0
      if (pulling) {
        setPulling(false)
        setRefreshing(true)
        await onRefresh()
        setRefreshing(false)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [pulling, onRefresh])

  return { pulling, refreshing }
}
