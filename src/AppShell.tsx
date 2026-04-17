/**
 * AppShell.tsx
 * Persistent nav header + layout wrapper for all pages.
 */

import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from './contexts/AppContext'
import { NewVenueForm } from './components/ContributionForms'
import { BottomNav } from './components/BottomNav'
import { InstallPrompt } from './components/InstallPrompt'
import { AgeVerification } from './components/AgeVerification'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { city, favorites, dark, toggleDark } = useAppContext()
  const location = useLocation()
  const navigate = useNavigate()
  const [showAddForm, setShowAddForm] = useState(false)

  const citySlug = city.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="shell">
      {/* ── NAV ── */}
      <header className="shell-nav">
        <Link to="/" className="shell-logo">
          <span className="shell-logo-appy">Appy</span>
          <span className="shell-logo-hour">Hour</span>
          <span className="shell-logo-city">{city}</span>
        </Link>

        <nav className="shell-links">
          <Link to="/" className={`shell-link${location.pathname === '/' ? ' active' : ''}`}>Browse</Link>
          <Link to="/now" className="shell-link shell-link--live">
            <span className="shell-live-dot" />Live
          </Link>
          <Link to="/tonight" className={`shell-link${location.pathname === '/tonight' ? ' active' : ''}`}>Tonight</Link>
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
      <main className="shell-main">
        {children}
      </main>
      <AgeVerification />
      <InstallPrompt />
      <BottomNav />
    </div>
  )
}
