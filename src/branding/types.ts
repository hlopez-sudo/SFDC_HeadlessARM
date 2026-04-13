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
  colors: SiteBrandingColors
}

export const DEFAULT_LOGO_URL =
  'https://www.salesforce.com/news/wp-content/uploads/sites/3/2021/05/Salesforce-logo.jpg?w=2048&h=1152'

export const DEFAULT_BRANDING: SiteBranding = {
  siteName: 'My Commerce',
  logoMode: 'url',
  logoUrl: DEFAULT_LOGO_URL,
  logoDataUrl: '',
  colors: {
    main: '#00a1e0',
    highlight: '#ffffff',
    background: '#f5f5f5',
    text: '#333333',
  },
}
