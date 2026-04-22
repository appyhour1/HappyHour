/**
 * PrivacyPage.tsx
 * Route: /privacy
 */

import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  const appName = 'Happy Hour Unlocked'
  const email = 'info@happyhourunlocked.com'
  const siteUrl = 'www.happyhourunlocked.com'
  const lastUpdated = 'April 2026'

  return (
    <>
      <Helmet>
        <title>Privacy Policy — {appName}</title>
        <meta name="description" content={`Privacy policy for ${appName}`} />
      </Helmet>

      <div className="legal-page">
        <div className="legal-header">
          <Link to="/" className="legal-back">← Back</Link>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-date">Last updated: {lastUpdated}</p>
        </div>

        <div className="legal-body">

          <section className="legal-section">
            <h2>1. Who We Are</h2>
            <p>{appName} ({siteUrl}) is a free community-powered app that helps people in Cincinnati find happy hour deals. We're committed to protecting your privacy and being transparent about how we handle data.</p>
          </section>

          <section className="legal-section">
            <h2>2. Information We Collect</h2>
            <h3>Information you give us</h3>
            <ul>
              <li><strong>Email address</strong> — if you sign up for our weekly newsletter. We never sell or share your email. You can unsubscribe at any time via the unsubscribe link in any email we send.</li>
              <li><strong>Venue submissions</strong> — if you add a venue or suggest a correction, we store the venue name, address, deal details, and optionally your email for follow-up.</li>
            </ul>
            <h3>Information collected automatically</h3>
            <ul>
              <li><strong>Location</strong> — only if you tap "Use my location." We use this to show nearby venues and sort by distance. We do not store or transmit your location to our servers.</li>
              <li><strong>Usage analytics</strong> — we use PostHog to understand how people use the app (which pages are visited, which venues are clicked). This data is anonymized and never linked to your identity.</li>
              <li><strong>Local storage</strong> — we store your saved venues (favorites) and filter preferences in your browser's local storage. This data never leaves your device.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. How We Use Your Information</h2>
            <ul>
              <li>To send the weekly happy hour newsletter (email subscribers only)</li>
              <li>To improve the app based on anonymized usage patterns</li>
              <li>To contact you about a venue submission if needed</li>
              <li>To show venues near you (location, device only)</li>
              <li>To display relevant sponsored content from brand partners. Sponsors do not receive your personal data.</li>
            </ul>
            <p>We do not sell your data. We do not share your information with third parties except as described below.</p>
          </section>

          <section className="legal-section">
            <h2>4. Third-Party Services</h2>
            <ul>
              <li><strong>Supabase</strong> — our database provider. Venue data and email signups are stored securely on Supabase servers. Supabase is SOC 2 compliant and all data is encrypted at rest and in transit.</li>
              <li><strong>PostHog</strong> — anonymized analytics. PostHog may set cookies or use local storage to track session data. No personal data is sent. See our <Link to="/cookies">Cookie Policy</Link> for details.</li>
              <li><strong>Google Places API</strong> — used when adding venues to auto-fill address data. We do not store any data returned by Google Places beyond what you explicitly submit.</li>
              <li><strong>Vercel</strong> — our hosting provider.</li>
              <li><strong>Sponsored advertisers</strong> — {appName} displays paid sponsor banners from brand partners. These banners may link to third-party websites. We do not share your personal data with sponsors. When you tap a sponsor link and leave our app, the third-party site's own privacy policy applies.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Cookies and Local Storage</h2>
            <p>{appName} uses browser local storage to remember your saved venues, filter preferences, and whether you've dismissed certain prompts. This data is stored only on your device and is never transmitted to our servers. Our analytics provider PostHog may also set cookies for anonymized session tracking. You can clear all stored data at any time by clearing your browser's site data.</p>
            <p>For a full breakdown of every cookie and storage item we use, see our <Link to="/cookies">Cookie &amp; Data Policy</Link>.</p>
          </section>

          <section className="legal-section">
            <h2>6. Age Requirement</h2>
            <p>{appName} is intended for users who are 21 years of age or older, as the app promotes and facilitates access to alcoholic beverage promotions. By using this app, you confirm that you are of legal drinking age in your jurisdiction. We do not knowingly collect data from users under 21.</p>
          </section>

          <section className="legal-section">
            <h2>7. Data Retention</h2>
            <p>Email addresses are retained until you unsubscribe. Venue submissions are retained indefinitely as part of the community database. Anonymous analytics data is retained for 12 months. You may request deletion of any personal data by emailing us.</p>
          </section>

          <section className="legal-section">
            <h2>8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Unsubscribe from the newsletter at any time via the link in any email</li>
              <li>Opt out of anonymized analytics tracking</li>
            </ul>
            <p>To exercise any of these rights, email us at <a href={`mailto:${email}`}>{email}</a>.</p>
          </section>

          <section className="legal-section">
            <h2>9. Security</h2>
            <p>We use industry-standard security practices including HTTPS encryption for all data in transit and secure database access controls. However, no system is 100% secure and we cannot guarantee absolute security.</p>
          </section>

          <section className="legal-section">
            <h2>10. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. We'll update the "last updated" date at the top of this page. Continued use of the app after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section className="legal-section">
            <h2>11. Contact Us</h2>
            <p>Questions about this privacy policy? Email us at <a href={`mailto:${email}`}>{email}</a>.</p>
          </section>

        </div>

        <div className="legal-footer">
          <Link to="/terms" className="legal-link">Terms of Service</Link>
          <Link to="/cookies" className="legal-link">Cookie Policy</Link>
          <Link to="/" className="legal-link">Back to app</Link>
        </div>
      </div>
    </>
  )
}
