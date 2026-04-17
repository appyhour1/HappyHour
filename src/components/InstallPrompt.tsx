/**
 * InstallPrompt.tsx
 *
 * Shows a subtle "Add to Home Screen" banner on mobile.
 * Appears after the user has visited twice.
 * Dismissed state is remembered in localStorage.
 */

import React, { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed or dismissed
    const dismissed = localStorage.getItem('pwa_install_dismissed')
    const visits = parseInt(localStorage.getItem('visit_count') || '0') + 1
    localStorage.setItem('visit_count', String(visits))

    // Show after 2 visits, not if dismissed
    if (dismissed || visits < 2) return

    // Check if already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    // Listen for browser install prompt (Android Chrome)
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // For iOS — show manual instructions
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone
    if (isIOS && !isInStandaloneMode && visits >= 2) {
      setShow(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleInstall() {
    if (prompt) {
      prompt.prompt()
      prompt.userChoice.then(({ outcome }) => {
        if (outcome === 'accepted') setShow(false)
        setPrompt(null)
      })
    }
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem('pwa_install_dismissed', '1')
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  if (!show || installed) return null

  return (
    <div className="install-prompt">
      <div className="install-prompt-icon">🍺</div>
      <div className="install-prompt-text">
        <div className="install-prompt-title">Add Appy Hour to your home screen</div>
        <div className="install-prompt-sub">
          {isIOS
            ? 'Tap Share → Add to Home Screen'
            : 'Get quick access — works like a real app'
          }
        </div>
      </div>
      <div className="install-prompt-actions">
        {!isIOS && prompt && (
          <button className="install-prompt-btn" onClick={handleInstall}>
            Install
          </button>
        )}
        <button className="install-prompt-dismiss" onClick={handleDismiss}>✕</button>
      </div>
    </div>
  )
}
