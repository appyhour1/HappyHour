/**
 * useDarkMode.ts
 *
 * Dark mode toggle. Persists to localStorage.
 * Applies 'dark' class to <html> element so CSS variables can switch.
 * Respects system preference on first load if no saved preference.
 */

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'hh_dark_mode'

function getInitial(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) return saved === 'true'
    // Respect OS preference on first visit
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function useDarkMode() {
  const [dark, setDark] = useState(getInitial)

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(dark))
    } catch {}
  }, [dark])

  function toggle() {
    setDark(d => !d)
  }

  return { dark, toggle }
}
