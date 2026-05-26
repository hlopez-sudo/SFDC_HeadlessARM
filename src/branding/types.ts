export type SiteBrandingColors = {
  main: string
  highlight: string
  background: string
  text: string
}

export type SiteBranding = {
  siteName: string
  logoMode: 'default' | 'url' | 'upload'
  logoUrl: string
  logoDataUrl: string
  /** Empty uses DEFAULT_LOGO_URL at apply time (browser tab icon). */
  faviconUrl: string
  colors: SiteBrandingColors
}

export const DEFAULT_LOGO_URL =
  'https://www.salesforce.com/news/wp-content/uploads/sites/3/2021/05/Salesforce-logo.jpg?w=2048&h=1152'

export const DEFAULT_BRANDING: SiteBranding = {
  siteName: 'Headless360',
  logoMode: 'url',
  logoUrl: DEFAULT_LOGO_URL,
  logoDataUrl: '',
  faviconUrl: DEFAULT_LOGO_URL,
  colors: {
    main: '#00a1e0',
    highlight: '#ffffff',
    background: '#f5f5f5',
    text: '#333333',
  },
}
