/**
 * useViewMode.ts
 *
 * Manages the list / map / split view toggle.
 * Persists to ?view= URL param so links land in the right view.
 *
 * "split" is only activated on desktop (≥ 768px). On mobile it falls
 * back to "map" to avoid cramped layouts.
 */

import { useState, useEffect, useCallback } from 'react'

export type ViewMode = 'list' | 'map' | 'split'

const VALID: ViewMode[] = ['list', 'map', 'split']
const MOBILE_BREAKPOINT = 768

function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

function readFromUrl(): ViewMode {
  try {
    const p = new URLSearchParams(window.location.search)
    const v = p.get('view')
    if (v && VALID.includes(v as ViewMode)) return v as ViewMode
  } catch {}
  return 'list'
}

function writeToUrl(mode: ViewMode) {
  try {
    const p = new URLSearchParams(window.location.search)
    if (mode === 'list') p.delete('view')
    else p.set('view', mode)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  } catch {}
}

export function useViewMode() {
  const [view, setViewRaw] = useState<ViewMode>(() => {
    const fromUrl = readFromUrl()
    // collapse split → map on mobile at init time
    if (fromUrl === 'split' && isMobile()) return 'map'
    return fromUrl
  })

  const setView = useCallback((mode: ViewMode) => {
    const resolved = mode === 'split' && isMobile() ? 'map' : mode
    setViewRaw(resolved)
    writeToUrl(resolved)
  }, [])

  // Collapse split → map if window is resized to mobile
  useEffect(() => {
    function onResize() {
      if (isMobile() && view === 'split') {
        setViewRaw('map')
        writeToUrl('map')
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [view])

  return { view, setView, isSplit: view === 'split', isMap: view === 'map' || view === 'split', isList: view === 'list' || view === 'split' }
}
