import { DEFAULT_CATALOG, type CatalogProduct, type ProductCatalog, type SellingModelEntry } from './types'

const STORAGE_KEY = 'fc-product-catalog'

function parseCatalogProduct(raw: unknown): CatalogProduct | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.id !== 'string' ||
    typeof r.name !== 'string' ||
    typeof r.family !== 'string' ||
    typeof r.description !== 'string' ||
    typeof r.sfProductId !== 'string'
  ) {
    return null
  }
  return {
    id: r.id,
    name: r.name,
    family: r.family,
    description: r.description,
    sfProductId: r.sfProductId,
    imageUrl: typeof r.imageUrl === 'string' ? r.imageUrl : '',
  }
}

function parseSellingModelEntry(raw: unknown): SellingModelEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.displayName !== 'string' || typeof r.sfId !== 'string') {
    return null
  }
  return { id: r.id, displayName: r.displayName, sfId: r.sfId }
}

function parseStored(raw: string | null): ProductCatalog | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Partial<ProductCatalog>
    if (typeof data !== 'object' || data === null) return null
    const products = Array.isArray(data.products)
      ? (data.products.map(parseCatalogProduct).filter(Boolean) as CatalogProduct[])
      : DEFAULT_CATALOG.products
    const sellingModels = Array.isArray(data.sellingModels)
      ? (data.sellingModels.map(parseSellingModelEntry).filter(Boolean) as SellingModelEntry[])
      : DEFAULT_CATALOG.sellingModels
    return {
      pageHeader:
        typeof data.pageHeader === 'string' ? data.pageHeader : DEFAULT_CATALOG.pageHeader,
      pageDescription:
        typeof data.pageDescription === 'string'
          ? data.pageDescription
          : DEFAULT_CATALOG.pageDescription,
      products,
      sellingModels,
    }
  } catch {
    return null
  }
}

export function loadCatalogFromStorage(): ProductCatalog {
  try {
    const parsed = parseStored(localStorage.getItem(STORAGE_KEY))
    return parsed ?? DEFAULT_CATALOG
  } catch {
    return DEFAULT_CATALOG
  }
}

export function saveCatalogToStorage(catalog: ProductCatalog): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog))
  } catch {
    // ignore quota / private mode
  }
}
