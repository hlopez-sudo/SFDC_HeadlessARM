import { darkenHex, hexAlpha, hexToRgb, mixRgb } from './colorUtils'
import { DEFAULT_BRANDING, type SiteBranding } from './types'

const GRAY_MUTED: { r: number; g: number; b: number } = { r: 128, g: 128, b: 128 }

function resolveHex(hex: string, fallback: string): string {
  return hexToRgb(hex) ? hex : fallback
}

export function applyBrandingToDocument(branding: SiteBranding): void {
  const root = document.documentElement
  const main = resolveHex(branding.colors.main, DEFAULT_BRANDING.colors.main)
  const highlight = resolveHex(branding.colors.highlight, DEFAULT_BRANDING.colors.highlight)
  const background = resolveHex(branding.colors.background, DEFAULT_BRANDING.colors.background)
  const text = resolveHex(branding.colors.text, DEFAULT_BRANDING.colors.text)

  const textRgb = hexToRgb(text)
  const highlightRgb = hexToRgb(highlight)
  const surfaceRgb = highlightRgb ?? { r: 255, g: 255, b: 255 }

  root.style.setProperty('--fc-accent', main)
  root.style.setProperty('--fc-accent-hover', darkenHex(main, 0.14))
  root.style.setProperty('--fc-accent-muted', hexAlpha(main, 0.12))

  root.style.setProperty('--fc-nav-bg', highlight)
  root.style.setProperty('--fc-surface', highlight)
  const sidebarBg = textRgb
    ? mixRgb(surfaceRgb, textRgb, 0.04)
    : '#fafafa'
  root.style.setProperty('--fc-sidebar-bg', sidebarBg)

  root.style.setProperty('--fc-page-bg', background)
  root.style.setProperty('--fc-text', text)

  if (textRgb) {
    root.style.setProperty('--fc-text-muted', mixRgb(textRgb, GRAY_MUTED, 0.38))
    root.style.setProperty('--fc-text-subtle', mixRgb(textRgb, GRAY_MUTED, 0.52))
  }

  if (textRgb && highlightRgb) {
    root.style.setProperty('--fc-border', mixRgb(highlightRgb, textRgb, 0.14))
    root.style.setProperty('--fc-border-light', mixRgb(highlightRgb, textRgb, 0.08))
  }

  document.title = branding.siteName.trim() || 'My Commerce'

  const faviconHref = branding.faviconUrl.trim() || DEFAULT_BRANDING.faviconUrl
  let iconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
  if (!iconLink) {
    iconLink = document.createElement('link')
    iconLink.rel = 'icon'
    document.head.appendChild(iconLink)
  }
  iconLink.href = faviconHref
}
