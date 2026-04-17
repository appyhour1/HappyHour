/**
 * AboutPage.tsx
 * Route: /about
 */

import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'

export default function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About — Appy Hour Cincinnati</title>
        <meta name="description" content="Appy Hour connects Cincinnati bar-goers with the best happy hour deals while helping local bars fill seats during slower hours." />
      </Helmet>

      <div className="about-page">

        {/* ── HERO ── */}
        <div className="about-hero">
          <div className="about-hero-logo">
            <span className="about-logo-appy">Appy</span>
            <span className="about-logo-hour">Hour</span>
          </div>
          <p className="about-hero-tagline">
            Connecting Cincinnati to its best happy hours.
          </p>
        </div>

        {/* ── MISSION ── */}
        <div className="about-section">
          <div className="about-section-icon">🍺</div>
          <h2 className="about-section-title">Why we built this</h2>
          <p className="about-section-body">
            Happy hours are one of the best things about going out — great drinks, great prices, great company. But finding them was always a hassle. Googling bar websites, checking outdated Yelp pages, texting friends who might know. There was no single place that just told you what was happening right now, near you, with real prices.
          </p>
          <p className="about-section-body">
            So we built Appy Hour. One place for Cincinnati's best happy hour deals, with live status, verified times, and real deal information.
          </p>
        </div>

        {/* ── WIN-WIN ── */}
        <div className="about-section">
          <div className="about-section-icon">🤝</div>
          <h2 className="about-section-title">Good for everyone</h2>
          <p className="about-section-body">
            Happy hours exist because bars want to bring in customers during slower hours. Appy Hour helps make that happen — by putting the right deal in front of the right person at exactly the right moment.
          </p>
          <div className="about-cards">
            <div className="about-card">
              <div className="about-card-icon">🏠</div>
              <div className="about-card-title">For bars & restaurants</div>
              <div className="about-card-body">Get discovered by people actively looking for somewhere to go right now. More seats filled during happy hour means a better evening for everyone.</div>
            </div>
            <div className="about-card">
              <div className="about-card-icon">🙋</div>
              <div className="about-card-title">For customers</div>
              <div className="about-card-body">Find great deals without the guesswork. See exactly what's on special, when it ends, and how to get there — before you leave the house.</div>
            </div>
          </div>
        </div>

        {/* ── COMMUNITY ── */}
        <div className="about-section">
          <div className="about-section-icon">🌆</div>
          <h2 className="about-section-title">Built by Cincinnati, for Cincinnati</h2>
          <p className="about-section-body">
            Every deal on Appy Hour is submitted or confirmed by real people who go out in Cincinnati. When you tap "Still accurate" on a venue, you're helping your neighbors make better plans. The more people use it, the better it gets for everyone.
          </p>
          <p className="about-section-body">
            Know a bar with a great happy hour that's not listed? Add it. See a deal that's changed? Suggest a correction. This app gets better every time someone contributes.
          </p>
        </div>

        {/* ── CTA ── */}
        <div className="about-cta">
          <Link to="/" className="about-cta-btn">Find a happy hour →</Link>
          <Link to="/" className="about-add-btn" onClick={() => {}}>+ Add your bar</Link>
        </div>

        {/* ── FOOTER LINKS ── */}
        <div className="about-legal">
          <Link to="/privacy" className="about-legal-link">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms" className="about-legal-link">Terms of Service</Link>
          <span>·</span>
          <a href="mailto:hello@appyhour.app" className="about-legal-link">Contact</a>
        </div>

      </div>
    </>
  )
}
