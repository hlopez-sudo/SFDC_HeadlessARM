import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type TrialParams = {
  productId: string
  productName: string
  sellingModel: string
  quantity: number
  accountName: string | null
}

type TrialDrawerContextValue = {
  isOpen: boolean
  params: TrialParams | null
  openTrial: (params: TrialParams) => void
  closeTrial: () => void
}

const TrialDrawerContext = createContext<TrialDrawerContextValue | null>(null)

export function TrialDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [params, setParams] = useState<TrialParams | null>(null)

  const openTrial = useCallback((next: TrialParams) => {
    setParams(next)
    setIsOpen(true)
  }, [])

  // Collapse only — params (and the drawer's submission state) are preserved
  const closeTrial = useCallback(() => setIsOpen(false), [])

  const value = useMemo(
    () => ({ isOpen, params, openTrial, closeTrial }),
    [isOpen, params, openTrial, closeTrial],
  )

  return <TrialDrawerContext.Provider value={value}>{children}</TrialDrawerContext.Provider>
}

export function useTrialDrawer(): TrialDrawerContextValue {
  const ctx = useContext(TrialDrawerContext)
  if (!ctx) throw new Error('useTrialDrawer must be used within TrialDrawerProvider')
  return ctx
}
