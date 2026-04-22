import React from 'react'
import { Analytics } from '../services/analytics'

const REDBULL_LOGO = "/redbull-logo.jpg"
const TITOS_LOGO = "/titos-logo.jpg" 

export interface BrandAd {
  id: string
  brand_name: string
  headline: string
  subtext: string
  logo_url: string
  logo_bg_color: string
  is_active: boolean
  position: number
}

interface BrandConfig {
  bg: string
  logoBg: string
  headlineColor: string
  accentWord: string        // last word of headline gets this color
  subColor: string
  tagline: string
  tagColor: string
  accentLine?: string       // left accent bar color
  style: 'redbull' | 'titos' | 'uber' | 'default'
}

const BRAND_CONFIGS: Record<string, BrandConfig> = {
  'red bull': {
    bg: '#1B47C8',          // Red Bull royal blue
    logoBg: '#CC1E4A',
    headlineColor: '#ffffff',
    accentWord: '#FFC906',  // Red Bull gold/yellow
    subColor: 'rgba(255,255,255,.55)',
    tagline: "GIVES YOU WINGS",
    tagColor: '#FFC906',
    style: 'redbull',
  },
  "tito's vodka": {
    bg: '#1E1208',          // Dark warm brown, like the wood
    logoBg: '#C87941',
    headlineColor: '#F5E6C8',   // warm cream
    accentWord: '#C87941',
    subColor: 'rgba(245,230,200,.55)',
    tagline: "AMERICA'S ORIGINAL CRAFT VODKA",
    tagColor: '#C87941',
    accentLine: '#C87941',
    style: 'titos',
  },
  'uber & lyft': {
    bg: '#000000',
    logoBg: '#111111',
    headlineColor: '#ffffff',
    accentWord: '#FF00BF',
    subColor: 'rgba(255,255,255,.5)',
    tagline: 'UBER & LYFT · OFFICIAL RIDE PARTNER',
    tagColor: '#FF00BF',
    style: 'uber',
  },
}

const DEFAULT_CONFIG: BrandConfig = {
  bg: '#3A3630',
  logoBg: '#E85D1A',
  headlineColor: '#ffffff',
  accentWord: '#E85D1A',
  subColor: 'rgba(255,255,255,.55)',
  tagline: '',
  tagColor: 'rgba(255,255,255,.3)',
  style: 'default',
}

function getConfig(brandName: string): BrandConfig {
  return BRAND_CONFIGS[brandName.toLowerCase().trim()] || DEFAULT_CONFIG
}

// Split headline — accent the last word
function HeadlineSplit({ text, cfg }: { text: string; cfg: BrandConfig }) {
  const words = text.trim().split(' ')
  const last = words.pop()
  const rest = words.join(' ')

  if (cfg.style === 'redbull') {
    return (
      <div style={{ fontSize: 15, fontWeight: 900, color: cfg.headlineColor, lineHeight: 1.15, marginBottom: 3, letterSpacing: '-.2px' }}>
        {rest}{' '}
        <span style={{ color: cfg.accentWord, fontStyle: 'italic' }}>{last}</span>
      </div>
    )
  }

  if (cfg.style === 'titos') {
    return (
      <div style={{ fontSize: 14, fontWeight: 800, color: cfg.headlineColor, lineHeight: 1.2, marginBottom: 3, letterSpacing: '-.1px' }}>
        {rest}{' '}
        <span style={{ color: cfg.accentWord }}>{last}</span>
      </div>
    )
  }

  if (cfg.style === 'uber') {
    return (
      <div style={{ fontSize: 14, fontWeight: 900, color: cfg.headlineColor, lineHeight: 1.15, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.01em' }}>
        {rest}{' '}
        <span style={{ color: cfg.accentWord }}>{last}</span>
      </div>
    )
  }

  return (
    <div style={{ fontSize: 14, fontWeight: 800, color: cfg.headlineColor, lineHeight: 1.2, marginBottom: 3 }}>
      {text}
    </div>
  )
}

function LogoBox({ ad, cfg }: { ad: BrandAd; cfg: BrandConfig }) {
  const key = ad.brand_name.toLowerCase().trim()

  if (ad.logo_url) {
    return (
      <div style={{ width: 52, height: 52, borderRadius: 10, background: cfg.logoBg, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={ad.logo_url} alt={ad.brand_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
      </div>
    )
  }

  if (key === 'red bull') {
    return (
      <div style={{ width: 52, height: 52, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', padding: 4 }}>
        <img src={REDBULL_LOGO} alt="Red Bull" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    )
  }

  if (key === "tito's vodka") {
    return (
      <div style={{ width: 52, height: 52, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', padding: 3 }}>
        <img src={TITOS_LOGO} alt="Tito's Vodka" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    )
  }

  if (key === 'uber & lyft') {
    return (
      <div style={{ width: 52, height: 52, borderRadius: 10, background: '#111', border: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, gap: 2 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: '#fff', letterSpacing: '.06em' }}>UBER</div>
        <div style={{ width: 26, height: 1, background: '#333' }} />
        <div style={{ fontSize: 11, fontWeight: 900, color: '#FF00BF' }}>LYFT</div>
      </div>
    )
  }

  const initials = ad.brand_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: 52, height: 52, borderRadius: 10, background: cfg.logoBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{initials}</span>
    </div>
  )
}

export function SponsoredBanner({ ad }: { ad: BrandAd }) {
  const [visible, setVisible] = React.useState(false)
  const cfg = getConfig(ad.brand_name)

  React.useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => {
      setVisible(true)
      // Fire impression event
      Analytics.adImpression(ad.id, ad.brand_name)
    }, 40)
    return () => clearTimeout(t)
  }, [ad.id])

  return (
    <div style={{
      marginBottom: 10,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity .4s ease, transform .4s ease',
    }}>
      <div onClick={() => Analytics.adClicked(ad.id, ad.brand_name)} style={{
        background: cfg.bg,
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        // Tito's gets a left copper accent bar
        borderLeft: cfg.accentLine ? `3px solid ${cfg.accentLine}` : undefined,
      }}>

        {/* Red Bull: subtle blue-on-blue right edge accent circle */}
        {cfg.style === 'redbull' && (
          <div style={{ position: 'absolute', right: -24, top: -24, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,201,6,.08)', pointerEvents: 'none' }} />
        )}

        <LogoBox ad={ad} cfg={cfg} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <HeadlineSplit text={ad.headline} cfg={cfg} />

          {/* Red Bull accent rule */}
          {cfg.style === 'redbull' && (
            <div style={{ width: 24, height: 2, background: '#CC1E4A', borderRadius: 2, marginBottom: 5 }} />
          )}

          <div style={{
            fontSize: 11,
            color: cfg.subColor,
            lineHeight: 1.45,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: cfg.tagline ? 5 : 0,
          }}>
            {ad.subtext}
          </div>

          {cfg.tagline && (
            <div style={{
              fontSize: 9,
              fontWeight: 800,
              color: cfg.tagColor,
              letterSpacing: '.1em',
              textTransform: 'uppercase' as const,
            }}>
              {cfg.tagline}
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', fontSize: 9, color: '#888', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' as const, marginTop: 3, paddingRight: 4 }}>
        Sponsored
      </div>
    </div>
  )
}
