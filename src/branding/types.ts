export type SiteBrandingColors = {
  main: string
  highlight: string
  background: string
  text: string
}

export type PlgProductRef = {
  name: string
  id: string
  description: string
  /** Relative Salesforce path, e.g. /services/images/photo/… — prepend instanceUrl to display */
  displayUrl: string
}

export type SiteBranding = {
  siteName: string
  logoMode: 'default' | 'url' | 'upload'
  logoUrl: string
  logoDataUrl: string
  /** Empty uses DEFAULT_LOGO_URL at apply time (browser tab icon). */
  faviconUrl: string
  colors: SiteBrandingColors
  /** When true, shows Sign Up Now and hides Products + Quotes in navigation. */
  enablePlg: boolean
  plgTrialProduct: PlgProductRef
  plgBuyNowProduct: PlgProductRef
  plgEnterpriseProduct: PlgProductRef
  plgCustomProduct: PlgProductRef
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
  enablePlg: false,
  plgTrialProduct:      { name: '', id: '', description: '', displayUrl: '' },
  plgBuyNowProduct:     { name: '', id: '', description: '', displayUrl: '' },
  plgEnterpriseProduct: { name: '', id: '', description: '', displayUrl: '' },
  plgCustomProduct:     { name: '', id: '', description: '', displayUrl: '' },
}
