/**
 * AppShell.tsx
 * Persistent nav header + layout wrapper for all pages.
 * Includes Capacitor back button handling and external link support.
 */

import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from './contexts/AppContext'
import { NewVenueForm } from './components/ContributionForms'
import { BottomNav } from './components/BottomNav'
import { InstallPrompt } from './components/InstallPrompt'
import { AgeVerification } from './components/AgeVerification'
import { Onboarding } from './components/Onboarding'

// Detect native Capacitor environment
const isNative = !!(window as any).Capacitor?.isNativePlatform?.()

// Open external links in system browser on native, new tab on web
async function openExternal(url: string) {
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
    } catch {
      window.open(url, '_blank')
    }
  } else {
    window.open(url, '_blank')
  }
}

export { openExternal }

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { city, favorites } = useAppContext()
  const location = useLocation()
  const navigate = useNavigate()
  const [showAddForm, setShowAddForm] = useState(false)

  const citySlug = city.toLowerCase().replace(/\s+/g, '-')

  // Android hardware back button handler
  useEffect(() => {
    if (!isNative) return

    let cleanup: (() => void) | undefined

    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', ({ canGoBack }) => {
        if (location.pathname === '/') {
          // On home screen — exit app
          App.exitApp()
        } else {
          // Navigate back within the app
          navigate(-1)
        }
      }).then(handle => {
        cleanup = () => handle.remove()
      })
    })

    return () => { cleanup?.() }
  }, [location.pathname, navigate])

  return (
    <div className="shell">
      {/* ── NAV ── */}
      <header className="shell-nav">
        <Link to="/" className="shell-logo">
          <span className="shell-logo-appy">Happy Hour</span>
          <span className="shell-logo-hour"> Unlocked</span>
          <span className="shell-logo-city">{city}</span>
        </Link>

        <nav className="shell-links">
          <Link to="/" className={`shell-link${location.pathname === '/' ? ' active' : ''}`}>Browse</Link>
          <Link to="/now" className="shell-link shell-link--live">
            <span className="shell-live-dot" />Live
          </Link>
          <Link to="/tonight" className={`shell-link${location.pathname === '/tonight' ? ' active' : ''}`}>Tonight</Link>
          <Link to="/about" className={`shell-link${location.pathname === '/about' ? ' active' : ''}`}>About</Link>
          <Link to="/crawl" className={`shell-link${location.pathname === '/crawl' ? ' active' : ''}`}>🍺 Bar Crawl</Link>
        </nav>

        <div className="shell-actions">
          {favorites.count > 0 && (
            <span className="shell-fav-count" title="Saved venues">♥ {favorites.count}</span>
          )}
          <Link to="/admin" className="shell-admin-btn" title="Admin">⚙️</Link>
          <button className="shell-add-btn" onClick={() => setShowAddForm(true)}>
            + Add a spot
          </button>
        </div>
      </header>

      {/* ── ADD FORM MODAL ── */}
      {showAddForm && (
        <div className="shell-modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddForm(false)}>
          <div className="shell-modal">
            <button className="shell-modal-close" onClick={() => setShowAddForm(false)}>✕</button>
            <NewVenueForm onClose={() => setShowAddForm(false)} />
          </div>
        </div>
      )}

      {/* ── PAGE CONTENT ── */}
      <main className="shell-main" style={{ maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {children}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '0.5px solid var(--border)',
        padding: '20px 1.25rem 80px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/about" style={{ fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none', fontWeight: 500 }}>About</Link>
          <span style={{ color: 'var(--border-2)' }}>·</span>
          <Link to="/privacy" style={{ fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none', fontWeight: 500 }}>Privacy Policy</Link>
          <span style={{ color: 'var(--border-2)' }}>·</span>
          <Link to="/terms" style={{ fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none', fontWeight: 500 }}>Terms of Service</Link>
          <span style={{ color: 'var(--border-2)' }}>·</span>
          <Link to="/cookies" style={{ fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none', fontWeight: 500 }}>Cookie Policy</Link>
          <span style={{ color: 'var(--border-2)' }}>·</span>
          <a
            href="mailto:info@happyhourunlocked.com"
            style={{ fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none', fontWeight: 500 }}
          >
            Contact
          </a>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
          © {new Date().getFullYear()} Happy Hour Unlocked · Cincinnati, Ohio
        </div>
      </footer>

      <Onboarding />
      <AgeVerification />
      {!isNative && <InstallPrompt />}
      <BottomNav />
    </div>
  )
}
