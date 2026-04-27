import { useCatalog } from '../catalog/CatalogContext'

export type SellingModelOption = {
  id: string
  name: string
}

export function useProductSellingModels(): SellingModelOption[] {
  const { catalog } = useCatalog()
  return catalog.sellingModels.map((entry) => ({ id: entry.sfId, name: entry.displayName }))
}
