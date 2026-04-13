import { DEFAULT_BRANDING, type SiteBranding } from './types'

const STORAGE_KEY = 'fc-site-branding'

function parseStored(raw: string | null): SiteBranding | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Partial<SiteBranding>
    if (typeof data !== 'object' || data === null) return null
    const colors = data.colors
    if (
      !colors ||
      typeof colors.main !== 'string' ||
      typeof colors.highlight !== 'string' ||
      typeof colors.background !== 'string' ||
      typeof colors.text !== 'string'
    ) {
      return null
    }
    return {
      siteName: typeof data.siteName === 'string' ? data.siteName : DEFAULT_BRANDING.siteName,
      logoMode:
        data.logoMode === 'url' || data.logoMode === 'upload' || data.logoMode === 'default'
          ? data.logoMode
          : DEFAULT_BRANDING.logoMode,
      logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : '',
      logoDataUrl: typeof data.logoDataUrl === 'string' ? data.logoDataUrl : '',
      colors: {
        main: colors.main,
        highlight: colors.highlight,
        background: colors.background,
        text: colors.text,
      },
    }
  } catch {
    return null
  }
}

export function loadBrandingFromStorage(): SiteBranding {
  try {
    const parsed = parseStored(localStorage.getItem(STORAGE_KEY))
    return parsed ?? DEFAULT_BRANDING
  } catch {
    return DEFAULT_BRANDING
  }
}

export function saveBrandingToStorage(branding: SiteBranding): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(branding))
  } catch {
    // ignore quota / private mode
  }
}
