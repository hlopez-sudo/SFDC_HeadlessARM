import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { applyBrandingToDocument } from './applyBranding'
import { loadBrandingFromStorage, saveBrandingToStorage } from './storage'
import { DEFAULT_BRANDING, type SiteBranding } from './types'

type SiteBrandingContextValue = {
  branding: SiteBranding
  setBranding: (next: SiteBranding) => void
}

const SiteBrandingContext = createContext<SiteBrandingContextValue | null>(null)

export function SiteBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBrandingState] = useState<SiteBranding>(() => {
    const b = loadBrandingFromStorage()
    applyBrandingToDocument(b)
    return b
  })

  const setBranding = useCallback((next: SiteBranding) => {
    setBrandingState(next)
    saveBrandingToStorage(next)
    applyBrandingToDocument(next)
  }, [])

  const value = useMemo(
    () => ({ branding, setBranding }),
    [branding, setBranding],
  )

  return (
    <SiteBrandingContext.Provider value={value}>{children}</SiteBrandingContext.Provider>
  )
}

export function useSiteBranding(): SiteBrandingContextValue {
  const ctx = useContext(SiteBrandingContext)
  if (!ctx) {
    throw new Error('useSiteBranding must be used within SiteBrandingProvider')
  }
  return ctx
}

export { DEFAULT_BRANDING }
