/**
 * BottomNav.tsx
 *
 * Mobile bottom navigation bar. Fixed to the bottom of the screen.
 * Shows on mobile only (hidden on desktop via CSS).
 * 4 tabs: Browse, Live, Crawl, More (Add a spot).
 */

import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppContext } from '../contexts/AppContext'
import { isVenueActiveNow } from '../utils/filters'
import { NewVenueForm } from './ContributionForms'

function BrowseIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="1.5"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8"/>
      <rect x="13" y="3" width="8" height="8" rx="1.5"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8"/>
      <rect x="3" y="13" width="8" height="8" rx="1.5"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8"/>
      <rect x="13" y="13" width="8" height="8" rx="1.5"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  )
}

function LiveIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8"/>
      <path d="M6.3 6.3a8 8 0 0 0 0 11.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M17.7 6.3a8 8 0 0 1 0 11.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

function CrawlIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 17l4-8 4 5 3-3 4 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        fill={active ? 'none' : 'none'}/>
      <circle cx="3" cy="17" r="1.5" fill="currentColor"/>
      <circle cx="7" cy="9" r="1.5" fill="currentColor"/>
      <circle cx="11" cy="14" r="1.5" fill="currentColor"/>
      <circle cx="14" cy="11" r="1.5" fill="currentColor"/>
      <circle cx="18" cy="17" r="1.5" fill="currentColor"/>
    </svg>
  )
}

function AddIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

export function BottomNav() {
  const location = useLocation()
  const { venues } = useAppContext()
  const [showAddForm, setShowAddForm] = useState(false)

  const liveCount = venues.filter(v => isVenueActiveNow(v)).length
  const isLive = liveCount > 0

  const isHome  = location.pathname === '/'
  const isNow   = location.pathname === '/now'
  const isCrawl = location.pathname === '/crawl'

  return (
    <>
      <nav className="bottom-nav">
        <Link to="/" className={`bn-tab${isHome ? ' active' : ''}`}>
          <BrowseIcon active={isHome} />
          <span className="bn-label">Browse</span>
        </Link>

        <Link to="/now" className={`bn-tab${isNow ? ' active' : ''}${isLive ? ' bn-tab--live' : ''}`}>
          <div className="bn-live-wrap">
            <LiveIcon active={isNow} />
            {isLive && <span className="bn-live-dot" />}
          </div>
          <span className="bn-label">Live{liveCount > 0 ? ` (${liveCount})` : ''}</span>
        </Link>

        <Link to="/crawl" className={`bn-tab${isCrawl ? ' active' : ''}`}>
          <CrawlIcon active={isCrawl} />
          <span className="bn-label">Crawl</span>
        </Link>

        <button className="bn-tab bn-tab--add" onClick={() => setShowAddForm(true)}>
          <AddIcon />
          <span className="bn-label">Add spot</span>
        </button>
      </nav>

      {showAddForm && (
        <div className="shell-modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddForm(false)}>
          <div className="shell-modal">
            <button className="shell-modal-close" onClick={() => setShowAddForm(false)}>✕</button>
            <NewVenueForm onClose={() => setShowAddForm(false)} />
          </div>
        </div>
      )}
    </>
  )
}
