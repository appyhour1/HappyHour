import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AppProvider } from './contexts/AppContext'
import AppShell from './AppShell'
import BrowsePage from './pages/BrowsePage'
import VenueDetailPage from './pages/VenueDetailPage'
import SeoLandingPage from './pages/SeoLandingPage'
import CrawlBuilderPage from './pages/CrawlBuilderPage'
import NowPage from './pages/NowPage'
import EmailPreviewPage from './pages/EmailPreviewPage'
import TonightPage from './pages/TonightPage'
import PrivacyPage from './pages/PrivacyPage'
import AboutPage from './pages/AboutPage'
import TermsPage from './pages/TermsPage'
import './styles.css'

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {})
  })
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <HelmetProvider>
    <AppProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<BrowsePage />} />
            <Route path="/venue/:id" element={<VenueDetailPage />} />
            <Route path="/crawl" element={<CrawlBuilderPage />} />
            <Route path="/now" element={<NowPage />} />
            <Route path="/tonight" element={<TonightPage />} />
            <Route path="/admin/email-preview" element={<EmailPreviewPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/:city" element={<SeoLandingPage />} />
            <Route path="/:city/:slug" element={<SeoLandingPage />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AppProvider>
  </HelmetProvider>
)
