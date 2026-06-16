import { DEFAULT_BRANDING, type PlgProductRef, type SiteBranding } from './types'

const STORAGE_KEY = 'fc-site-branding'

function isPlgProduct(v: unknown): v is PlgProductRef {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as PlgProductRef).name === 'string' &&
    typeof (v as PlgProductRef).id === 'string'
  )
}

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
      faviconUrl:
        typeof data.faviconUrl === 'string' ? data.faviconUrl : DEFAULT_BRANDING.faviconUrl,
      colors: {
        main: colors.main,
        highlight: colors.highlight,
        background: colors.background,
        text: colors.text,
      },
      enablePlg: typeof data.enablePlg === 'boolean' ? data.enablePlg : false,
      plgTrialProduct: isPlgProduct(data.plgTrialProduct)
        ? {
            ...data.plgTrialProduct,
            description: typeof data.plgTrialProduct.description === 'string' ? data.plgTrialProduct.description : '',
            displayUrl:  typeof data.plgTrialProduct.displayUrl  === 'string' ? data.plgTrialProduct.displayUrl  : '',
          }
        : { name: '', id: '', description: '', displayUrl: '' },
      plgBuyNowProduct: isPlgProduct(data.plgBuyNowProduct)
        ? {
            ...data.plgBuyNowProduct,
            description: typeof data.plgBuyNowProduct.description === 'string' ? data.plgBuyNowProduct.description : '',
            displayUrl:  typeof data.plgBuyNowProduct.displayUrl  === 'string' ? data.plgBuyNowProduct.displayUrl  : '',
          }
        : { name: '', id: '', description: '', displayUrl: '' },
      plgEnterpriseProduct: isPlgProduct(data.plgEnterpriseProduct)
        ? {
            ...data.plgEnterpriseProduct,
            description: typeof data.plgEnterpriseProduct.description === 'string' ? data.plgEnterpriseProduct.description : '',
            displayUrl:  typeof data.plgEnterpriseProduct.displayUrl  === 'string' ? data.plgEnterpriseProduct.displayUrl  : '',
          }
        : { name: '', id: '', description: '', displayUrl: '' },
      plgCustomProduct: isPlgProduct(data.plgCustomProduct)
        ? {
            ...data.plgCustomProduct,
            description: typeof data.plgCustomProduct.description === 'string' ? data.plgCustomProduct.description : '',
            displayUrl:  typeof data.plgCustomProduct.displayUrl  === 'string' ? data.plgCustomProduct.displayUrl  : '',
          }
        : { name: '', id: '', description: '', displayUrl: '' },
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
