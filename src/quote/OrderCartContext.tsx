import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type OrderCartItem = {
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

type OrderCartContextValue = {
  items: OrderCartItem[]
  addItem: (item: Omit<OrderCartItem, 'id'>) => void
  removeItem: (id: string) => void
  clearCart: () => void
  isOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
}

const CART_KEY = 'fc-order-cart'

function loadItems(): OrderCartItem[] {
  try {
    const raw = sessionStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed as OrderCartItem[]
    return []
  } catch {
    return []
  }
}

const OrderCartContext = createContext<OrderCartContextValue | null>(null)

export function OrderCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<OrderCartItem[]>(() => loadItems())
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    try {
      sessionStorage.setItem(CART_KEY, JSON.stringify(items))
    } catch { /* ignore quota/private mode */ }
  }, [items])

  const addItem = useCallback((incoming: Omit<OrderCartItem, 'id'>) => {
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

  const openDrawer = useCallback(() => setIsOpen(true), [])
  const closeDrawer = useCallback(() => setIsOpen(false), [])

  const value = useMemo(
    () => ({ items, addItem, removeItem, clearCart, isOpen, openDrawer, closeDrawer }),
    [items, addItem, removeItem, clearCart, isOpen, openDrawer, closeDrawer],
  )

  return <OrderCartContext.Provider value={value}>{children}</OrderCartContext.Provider>
}

export function useOrderCart(): OrderCartContextValue {
  const ctx = useContext(OrderCartContext)
  if (!ctx) throw new Error('useOrderCart must be used within OrderCartProvider')
  return ctx
}
