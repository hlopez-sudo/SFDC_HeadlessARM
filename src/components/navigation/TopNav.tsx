import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
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

export function TopNav() {
  const [servicesOpen, setServicesOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)

  return (
    <header className={styles.bar}>
      <a className={styles.brand} href="/">
        <LogoMark />
        <span>FortiCloud</span>
      </a>
      <nav className={styles.center} aria-label="Primary">
        <button
          type="button"
          className={styles.navButton}
          aria-expanded={servicesOpen}
          aria-haspopup="menu"
          onClick={() => setServicesOpen((v) => !v)}
        >
          Services
          <ChevronDown size={16} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={styles.navButton}
          aria-expanded={supportOpen}
          aria-haspopup="menu"
          onClick={() => setSupportOpen((v) => !v)}
        >
          Support
          <ChevronDown size={16} strokeWidth={2} aria-hidden />
        </button>
      </nav>
      <div className={styles.spacer} aria-hidden />
    </header>
  )
}
