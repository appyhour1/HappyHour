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
import TonightPage from './pages/TonightPage'
import EmailPreviewPage from './pages/EmailPreviewPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import AboutPage from './pages/AboutPage'
import AdminPage from './pages/AdminPage'
import CookiePolicyPage from './pages/CookiePolicyPage'
import './styles/mobile-fix.css'
import './styles/additions.css'
import './styles.css'

// Unregister any cached service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister())
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
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/cookies" element={<CookiePolicyPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/:city" element={<SeoLandingPage />} />
            <Route path="/:city/:slug" element={<SeoLandingPage />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AppProvider>
  </HelmetProvider>
)
