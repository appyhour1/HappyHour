/**
 * CookiePolicyPage.tsx
 * Route: /cookies
 */

import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'

export default function CookiePolicyPage() {
  const appName = 'Happy Hour Unlocked'
  const email = 'info@happyhourunlocked.com'
  const siteUrl = 'www.happyhourunlocked.com'
  const lastUpdated = 'April 2026'

  return (
    <>
      <Helmet>
        <title>Cookie & Data Policy — {appName}</title>
        <meta name="description" content={`Cookie and data storage policy for ${appName}`} />
      </Helmet>

      <div className="legal-page">
        <div className="legal-header">
          <Link to="/" className="legal-back">← Back</Link>
          <h1 className="legal-title">Cookie &amp; Data Policy</h1>
          <p className="legal-date">Last updated: {lastUpdated}</p>
        </div>

        <div className="legal-body">

          <section className="legal-section">
            <h2>1. Overview</h2>
            <p>{appName} ({siteUrl}) uses a combination of browser cookies, local storage, and session storage to make the app work properly and to understand how people use it. This policy explains exactly what we store, why, and how you can control it.</p>
            <p>We keep data collection to the absolute minimum needed to run the app. We do not sell your data. We do not use advertising cookies or tracking pixels for ad targeting.</p>
          </section>

          <section className="legal-section">
            <h2>2. What Are Cookies?</h2>
            <p>Cookies are small text files that a website stores on your device when you visit. They allow the site to remember information about your visit — like your preferences or session state — so you don't have to re-enter it every time.</p>
            <p>We also use <strong>local storage</strong> and <strong>session storage</strong>, which work similarly to cookies but are stored differently in your browser and never sent to our servers automatically.</p>
          </section>

          <section className="legal-section">
            <h2>3. Cookies and Storage We Use</h2>

            <h3>Strictly Necessary</h3>
            <p>These are required for the app to function. You cannot opt out of these.</p>
            <ul>
              <li>
                <strong>Session cookie (Supabase)</strong> — type: cookie · duration: session<br />
                <span>Keeps you authenticated if you have an account. Cleared when you close the browser.</span>
              </li>
              <li>
                <strong>Auth token (Supabase)</strong> — type: local storage · duration: persistent<br />
                <span>Stores your login state so you stay signed in between visits. Cleared on sign-out.</span>
              </li>
            </ul>

            <h3>Functional</h3>
            <p>These remember your preferences to improve your experience. They don't track you across other sites.</p>
            <ul>
              <li>
                <strong>Saved venues / favorites</strong> — type: local storage · duration: persistent<br />
                <span>Stores the list of venues you've saved. Stays on your device. Never sent to our servers.</span>
              </li>
              <li>
                <strong>Filter preferences</strong> — type: local storage · duration: persistent<br />
                <span>Remembers your last-used filters (day, neighborhood, drink type) so you don't have to reset them each visit.</span>
              </li>
              <li>
                <strong>Onboarding state</strong> — type: local storage · duration: persistent<br />
                <span>Remembers whether you've completed the onboarding flow so we don't show it again on return visits.</span>
              </li>
              <li>
                <strong>Dark mode preference</strong> — type: local storage · duration: persistent<br />
                <span>Stores your display theme choice.</span>
              </li>
              <li>
                <strong>Dismissed prompts</strong> — type: local storage · duration: persistent<br />
                <span>Remembers banners or prompts you've dismissed so they don't reappear.</span>
              </li>
            </ul>

            <h3>Analytics</h3>
            <p>These help us understand how people use the app so we can improve it. All analytics data is anonymized — it is never linked to your identity.</p>
            <ul>
              <li>
                <strong>PostHog analytics</strong> — type: cookie + local storage · duration: 1 year<br />
                <span>PostHog sets cookies to track anonymized usage patterns — which pages are viewed, which venues are clicked, and general navigation flow. No personal data (name, email, location) is ever sent to PostHog. You can opt out at any time (see Section 5).</span>
              </li>
            </ul>

            <h3>What We Do NOT Use</h3>
            <ul>
              <li>No advertising or retargeting cookies</li>
              <li>No Facebook Pixel or Google Ads tracking</li>
              <li>No cross-site tracking of any kind</li>
              <li>No fingerprinting or device identification</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Sponsored Ads and Third-Party Links</h2>
            <p>{appName} displays paid sponsor banners from brands such as beverage companies and rideshare services. These banners may contain links to third-party websites.</p>
            <ul>
              <li>We do not share your personal data with sponsors</li>
              <li>Sponsors do not have access to your usage data or device storage</li>
              <li>When you tap a sponsor link and leave our app, the third-party site's own cookie and privacy policies apply</li>
              <li>We are not responsible for the data practices of third-party sites you visit through sponsor links</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Your Choices and Opt-Out Options</h2>

            <h3>Clear app data</h3>
            <p>You can clear all locally stored data (saved venues, preferences, onboarding state) by clearing your browser's site data. In most browsers: Settings → Privacy → Clear browsing data → Cached images and files + Cookies and site data.</p>

            <h3>Opt out of PostHog analytics</h3>
            <p>To opt out of anonymized analytics tracking, email us at <a href={`mailto:${email}`}>{email}</a> with the subject line "Opt out of analytics" and we will add your session to our opt-out list. You can also disable cookies entirely in your browser settings, which will prevent PostHog from setting any cookies.</p>

            <h3>Browser-level cookie controls</h3>
            <p>All modern browsers allow you to block or delete cookies. Note that blocking strictly necessary cookies may prevent parts of the app from working correctly (such as staying signed in). Here's how to manage cookies in common browsers:</p>
            <ul>
              <li><strong>Chrome</strong> — Settings → Privacy and security → Cookies and other site data</li>
              <li><strong>Safari (iPhone)</strong> — Settings → Safari → Privacy &amp; Security</li>
              <li><strong>Firefox</strong> — Settings → Privacy &amp; Security → Cookies and Site Data</li>
              <li><strong>Edge</strong> — Settings → Cookies and site permissions → Cookies and site data</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>6. Location Data</h2>
            <p>If you tap "Use my location," your device's GPS coordinates are used in-browser only to sort and filter nearby venues. Your location is <strong>never</strong> stored on our servers, never included in analytics, and never shared with any third party including sponsors. Location access is entirely optional — the app works without it.</p>
          </section>

          <section className="legal-section">
            <h2>7. Data We Store on Our Servers (Supabase)</h2>
            <p>The following data is stored in our secure Supabase database:</p>
            <ul>
              <li><strong>Email address</strong> — if you sign up for the newsletter</li>
              <li><strong>Venue submissions</strong> — venue name, address, deal details, and optionally your email if provided</li>
              <li><strong>Account data</strong> — if you create an account: email address and hashed password only</li>
            </ul>
            <p>We do not store payment information, phone numbers, full names, or any government-issued ID. Supabase is SOC 2 compliant and all data is encrypted at rest and in transit.</p>
          </section>

          <section className="legal-section">
            <h2>8. Children's Privacy</h2>
            <p>{appName} is intended for users 21 years of age or older. We do not knowingly collect any data from users under the age of 21. If you believe a minor has submitted data through our app, please contact us immediately at <a href={`mailto:${email}`}>{email}</a> and we will delete it promptly.</p>
          </section>

          <section className="legal-section">
            <h2>9. Changes to This Policy</h2>
            <p>We may update this policy as the app adds new features. We'll update the "last updated" date at the top of the page when changes are made. Continued use of the app after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section className="legal-section">
            <h2>10. Contact Us</h2>
            <p>Questions about cookies or how we handle your data? Email us at <a href={`mailto:${email}`}>{email}</a>. We'll respond within 5 business days.</p>
          </section>

        </div>

        <div className="legal-footer">
          <Link to="/privacy" className="legal-link">Privacy Policy</Link>
          <Link to="/terms" className="legal-link">Terms of Service</Link>
          <Link to="/" className="legal-link">Back to app</Link>
        </div>
      </div>
    </>
  )
}
