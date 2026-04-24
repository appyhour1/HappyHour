/**
 * InstallPrompt.tsx
 *
 * Shows a subtle "Add to Home Screen" banner on mobile.
 * Appears after the user has visited twice.
 * Dismissed state is remembered in localStorage.
 *
 * TRACKING (all events logged to PostHog + app_installs Supabase table):
 *   pwa_prompt_shown      — banner appeared
 *   pwa_install_accepted  — user tapped Install and confirmed (Android)
 *   pwa_install_dismissed — user tapped ✕
 *   pwa_installed         — browser fired appinstalled event (most reliable)
 *   pwa_ios_installed     — iOS user tapped "I installed it" confirmation
 */
import React, { useState, useEffect } from 'react'
import { track } from '../services/analytics'
import { supabase } from '../lib/supabase'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Log install event to PostHog and to Supabase app_installs table
async function logInstallEvent(eventName: string, platform: 'android' | 'ios' | 'unknown') {
  // PostHog
  track(eventName, { platform })

  // Supabase — best-effort, never throws
  try {
    await supabase.from('app_installs').insert({
      event_type: eventName,
      platform,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Silent — tracking should never break the UI
  }
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [showIOSConfirm, setShowIOSConfirm] = useState(false)

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const platform = isIOS ? 'ios' : 'android'

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

    // Android Chrome — listen for native install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
      logInstallEvent('pwa_prompt_shown', 'android')
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS — show manual instructions
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone
    if (isIOS && !isInStandaloneMode && visits >= 2) {
      setShow(true)
      logInstallEvent('pwa_prompt_shown', 'ios')
    }

    // Native appinstalled event — most reliable signal on Android
    const onInstalled = () => {
      setInstalled(true)
      setShow(false)
      logInstallEvent('pwa_installed', 'android')
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, []) // eslint-disable-line

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      logInstallEvent('pwa_install_accepted', 'android')
    } else {
      logInstallEvent('pwa_install_dismissed', 'android')
    }
    setPrompt(null)
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem('pwa_install_dismissed', '1')
    logInstallEvent('pwa_install_dismissed', platform)
  }

  // iOS users can confirm they installed it manually
  function handleIOSInstallConfirm() {
    setShowIOSConfirm(false)
    setShow(false)
    localStorage.setItem('pwa_install_dismissed', '1')
    logInstallEvent('pwa_ios_installed', 'ios')
  }

  if (!show || installed) return null

  return (
    <div className="install-prompt">
      <div className="install-prompt-icon">🔓</div>
      <div className="install-prompt-text">
        <div className="install-prompt-title">Add Happy Hour Unlocked to your home screen</div>
        <div className="install-prompt-sub">
          {isIOS
            ? 'Tap Share → Add to Home Screen for quick access'
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
        {isIOS && !showIOSConfirm && (
          <button className="install-prompt-btn" onClick={() => setShowIOSConfirm(true)}>
            Got it
          </button>
        )}
        {isIOS && showIOSConfirm && (
          <button className="install-prompt-btn" onClick={handleIOSInstallConfirm}>
            ✓ Installed
          </button>
        )}
        <button className="install-prompt-dismiss" onClick={handleDismiss}>✕</button>
      </div>
    </div>
  )
}
