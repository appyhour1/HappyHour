/**
 * AppShell.tsx
 * Persistent nav header + layout wrapper for all pages.
 */

import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppContext } from './contexts/AppContext'
import { NewVenueForm } from './components/ContributionForms'
import { BottomNav } from './components/BottomNav'
import { InstallPrompt } from './components/InstallPrompt'
import { AgeVerification } from './components/AgeVerification'
import { Onboarding } from './components/Onboarding'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { city, favorites, dark, toggleDark } = useAppContext()
  const location = useLocation()
  const [showAddForm, setShowAddForm] = useState(false)

  const citySlug = city.toLowerCase().replace(/\s+/g, '-')

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
          <Link to={`/${citySlug}`} className="shell-link">City Guide</Link>
          <Link to="/crawl" className={`shell-link${location.pathname === '/crawl' ? ' active' : ''}`}>🍺 Bar Crawl</Link>
        </nav>

        <div className="shell-actions">
          {favorites.count > 0 && (
            <span className="shell-fav-count" title="Saved venues">♥ {favorites.count}</span>
          )}
          <button
            className="shell-dark-btn"
            onClick={toggleDark}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? '☀️' : '🌙'}
          </button>
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
      <main className="shell-main" style={{ maxWidth: 600, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {children}
      </main>

      <Onboarding />
      <AgeVerification />
      <InstallPrompt />
      <BottomNav />
    </div>
  )
}
