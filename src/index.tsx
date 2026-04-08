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
import './styles.css'

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
            <Route path="/:city" element={<SeoLandingPage />} />
            <Route path="/:city/:slug" element={<SeoLandingPage />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AppProvider>
  </HelmetProvider>
)
