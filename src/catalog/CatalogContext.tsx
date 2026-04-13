import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { loadCatalogFromStorage, saveCatalogToStorage } from './storage'
import { DEFAULT_CATALOG, type ProductCatalog } from './types'

type CatalogContextValue = {
  catalog: ProductCatalog
  setCatalog: (next: ProductCatalog) => void
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalogState] = useState<ProductCatalog>(() => loadCatalogFromStorage())

  const setCatalog = useCallback((next: ProductCatalog) => {
    setCatalogState(next)
    saveCatalogToStorage(next)
  }, [])

  const value = useMemo(() => ({ catalog, setCatalog }), [catalog, setCatalog])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext)
  if (!ctx) {
    throw new Error('useCatalog must be used within CatalogProvider')
  }
  return ctx
}

export { DEFAULT_CATALOG }
