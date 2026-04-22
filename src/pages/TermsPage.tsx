/**
 * TermsPage.tsx
 * Route: /terms
 */

import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'

export default function TermsPage() {
  const appName = 'Happy Hour Unlocked'
  const email = 'info@happyhourunlocked.com'
  const siteUrl = 'www.happyhourunlocked.com'
  const lastUpdated = 'April 2026'

  return (
    <>
      <Helmet>
        <title>Terms of Service — {appName}</title>
        <meta name="description" content={`Terms of service for ${appName}`} />
      </Helmet>

      <div className="legal-page">
        <div className="legal-header">
          <Link to="/" className="legal-back">← Back</Link>
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-date">Last updated: {lastUpdated}</p>
        </div>

        <div className="legal-body">

          <section className="legal-section">
            <h2>1. Acceptance of Terms</h2>
            <p>By accessing or using {appName} ({siteUrl}) ("the app"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the app. You must be 21 years of age or older to use {appName}.</p>
          </section>

          <section className="legal-section">
            <h2>2. What {appName} Is</h2>
            <p>{appName} is a community-powered directory of happy hour deals in Cincinnati, Ohio. We aggregate deal information submitted by users and verified by the community. We are not affiliated with, endorsed by, or employed by any of the venues listed.</p>
          </section>

          <section className="legal-section">
            <h2>3. Accuracy of Information</h2>
            <p>Happy hour deals change frequently. While we make our best effort to keep information accurate and up to date, <strong>{appName} does not guarantee that any deal, price, time, or offer listed is currently valid.</strong> Always verify deals directly with the venue before making decisions based on information in the app.</p>
            <p>We are not responsible for any loss, inconvenience, or disappointment resulting from inaccurate deal information.</p>
          </section>

          <section className="legal-section">
            <h2>4. User Contributions</h2>
            <p>By submitting a venue, deal, or correction through {appName}, you confirm that:</p>
            <ul>
              <li>The information is accurate to the best of your knowledge</li>
              <li>You are not submitting false, misleading, or spam content</li>
              <li>You grant {appName} a perpetual, royalty-free license to display and use the submitted information</li>
            </ul>
            <p>We reserve the right to remove or modify any user-submitted content at our discretion.</p>
          </section>

          <section className="legal-section">
            <h2>5. Alcohol and Age Verification</h2>
            <p>{appName} promotes alcoholic beverage deals. By using the app, you confirm that:</p>
            <ul>
              <li>You are 21 years of age or older</li>
              <li>You will consume alcohol responsibly and in compliance with all applicable laws</li>
              <li>You will not use the app to provide alcohol to minors</li>
            </ul>
            <p>{appName} promotes responsible drinking. Please drink responsibly and never drink and drive.</p>
          </section>

          <section className="legal-section">
            <h2>6. Prohibited Uses</h2>
            <p>You may not use {appName} to:</p>
            <ul>
              <li>Submit false, fraudulent, or misleading venue or deal information</li>
              <li>Spam, harass, or abuse other users or venue owners</li>
              <li>Scrape, copy, or reproduce the app's data for commercial purposes without permission</li>
              <li>Attempt to hack, reverse-engineer, or disrupt the app</li>
              <li>Violate any applicable local, state, or federal laws</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>7. Intellectual Property</h2>
            <p>The {appName} name, logo, design, and code are the property of {appName} and may not be reproduced without permission. Venue names, addresses, and factual deal information are not owned by {appName} and may be factual public information.</p>
          </section>

          <section className="legal-section">
            <h2>8. Disclaimer of Warranties</h2>
            <p>{appName} is provided "as is" without warranties of any kind, express or implied. We do not warrant that the app will be uninterrupted, error-free, or that deals listed are currently valid. Use the app at your own risk.</p>
          </section>

          <section className="legal-section">
            <h2>9. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, {appName} shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the app, including but not limited to reliance on inaccurate deal information.</p>
          </section>

          <section className="legal-section">
            <h2>10. Governing Law</h2>
            <p>These terms are governed by the laws of the State of Ohio. Any disputes shall be resolved in the courts of Hamilton County, Ohio.</p>
          </section>

          <section className="legal-section">
            <h2>11. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the app after changes constitutes acceptance. We'll update the "last updated" date when changes are made.</p>
          </section>

          <section className="legal-section">
            <h2>12. Contact</h2>
            <p>Questions about these terms? Email <a href={`mailto:${email}`}>{email}</a>.</p>
          </section>

        </div>

        <div className="legal-footer">
          <Link to="/privacy" className="legal-link">Privacy Policy</Link>
          <Link to="/cookies" className="legal-link">Cookie Policy</Link>
          <Link to="/" className="legal-link">Back to app</Link>
        </div>
      </div>
    </>
  )
}
