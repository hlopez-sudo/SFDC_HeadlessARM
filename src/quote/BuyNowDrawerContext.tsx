import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type BuyNowParams = {
  productId: string
  productName: string
  sellingModel: string
  sellingModelId?: string
  quantity: number
  unitPrice: number
  currencyIsoCode: string
  accountName: string | null
}

type BuyNowDrawerContextValue = {
  isOpen: boolean
  params: BuyNowParams | null
  openBuyNow: (params: BuyNowParams) => void
  closeBuyNow: () => void
}

const BuyNowDrawerContext = createContext<BuyNowDrawerContextValue | null>(null)

export function BuyNowDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [params, setParams] = useState<BuyNowParams | null>(null)

  const openBuyNow = useCallback((next: BuyNowParams) => {
    setParams(next)
    setIsOpen(true)
  }, [])

  // Collapse only — params (and the drawer's submission state) are preserved
  const closeBuyNow = useCallback(() => setIsOpen(false), [])

  const value = useMemo(
    () => ({ isOpen, params, openBuyNow, closeBuyNow }),
    [isOpen, params, openBuyNow, closeBuyNow],
  )

  return <BuyNowDrawerContext.Provider value={value}>{children}</BuyNowDrawerContext.Provider>
}

export function useBuyNowDrawer(): BuyNowDrawerContextValue {
  const ctx = useContext(BuyNowDrawerContext)
  if (!ctx) throw new Error('useBuyNowDrawer must be used within BuyNowDrawerProvider')
  return ctx
}
