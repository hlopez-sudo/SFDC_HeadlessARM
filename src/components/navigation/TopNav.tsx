import { useEffect, useMemo, useState } from 'react'
import { useSiteBranding } from '../../branding/SiteBrandingContext'
import type { SiteBranding } from '../../branding/types'
import styles from './TopNav.module.css'

function LogoMark() {
  return (
    <svg
      className={styles.brandMark}
      width="28"
      height="28"
      viewBox="0 0 32 32"
      aria-hidden
    >
      <path
        fill="var(--fc-accent)"
        d="M16 4c-4.5 0-8.2 3-9.4 7.1a6 6 0 0 0 5.8 7.4h1.1l1.2-5.5c.2-.9 1-1.5 1.9-1.5h5.8c.9 0 1.7.6 1.9 1.5l1.2 5.5h.3a6 6 0 0 0 6-6c0-5-4-9-9-9Z"
      />
      <path
        fill="#fff"
        opacity=".95"
        d="M12.5 12.5h7l-1.8 8.2a2 2 0 0 1-2 1.6h-1.4a2 2 0 0 1-2-1.6l-1.8-8.2Z"
      />
      <path
        fill="var(--fc-accent)"
        d="M10 22.5h12v2a3.5 3.5 0 0 1-3.5 3.5h-5A3.5 3.5 0 0 1 10 24.5v-2Z"
      />
    </svg>
  )
}

function resolveLogoSrc(branding: SiteBranding): 'default' | string {
  if (branding.logoMode === 'upload' && branding.logoDataUrl) {
    return branding.logoDataUrl
  }
  if (branding.logoMode === 'url') {
    const u = branding.logoUrl.trim()
    if (u.startsWith('https://')) return u
  }
  return 'default'
}

export function TopNav() {
  const { branding } = useSiteBranding()
  const [imgFailed, setImgFailed] = useState(false)

  const logoSrc = useMemo(() => resolveLogoSrc(branding), [branding])

  useEffect(() => {
    setImgFailed(false)
  }, [logoSrc])

  const showCustomLogo = logoSrc !== 'default' && !imgFailed

  return (
    <header className={styles.bar}>
      <a className={styles.brand} href="/">
        {showCustomLogo ? (
          <img
            className={styles.brandImg}
            src={logoSrc}
            alt=""
            onError={() => setImgFailed(true)}
          />
        ) : (
          <LogoMark />
        )}
        <span>{branding.siteName.trim() || 'Headless360'}</span>
      </a>
    </header>
  )
}
