import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type QuoteItem = {
  id: string
  productId: string
  productName: string
  quantity: number
  sellingModel: string
  sellingModelId?: string
  unitPrice: number
  lineTotal: number
  currencyIsoCode: string
}

type QuoteCartContextValue = {
  items: QuoteItem[]
  addItem: (item: Omit<QuoteItem, 'id'>) => void
  removeItem: (id: string) => void
  clearCart: () => void
  isModalOpen: boolean
  openModal: () => void
  closeModal: () => void
}

const CART_KEY = 'fc-quote-cart'

function loadItems(): QuoteItem[] {
  try {
    const raw = sessionStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed as QuoteItem[]
    return []
  } catch {
    return []
  }
}

const QuoteCartContext = createContext<QuoteCartContextValue | null>(null)

export function QuoteCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QuoteItem[]>(() => loadItems())
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    try {
      sessionStorage.setItem(CART_KEY, JSON.stringify(items))
    } catch { /* ignore quota/private mode */ }
  }, [items])

  const addItem = useCallback((incoming: Omit<QuoteItem, 'id'>) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.productId === incoming.productId && i.sellingModel === incoming.sellingModel,
      )
      if (existingIdx !== -1) {
        return prev.map((item, idx) =>
          idx === existingIdx ? { ...item, ...incoming } : item,
        )
      }
      return [...prev, { ...incoming, id: crypto.randomUUID() }]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const openModal = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])

  const value = useMemo(
    () => ({ items, addItem, removeItem, clearCart, isModalOpen, openModal, closeModal }),
    [items, addItem, removeItem, clearCart, isModalOpen, openModal, closeModal],
  )

  return <QuoteCartContext.Provider value={value}>{children}</QuoteCartContext.Provider>
}

export function useQuoteCart(): QuoteCartContextValue {
  const ctx = useContext(QuoteCartContext)
  if (!ctx) throw new Error('useQuoteCart must be used within QuoteCartProvider')
  return ctx
}
