export type CatalogProduct = {
  id: string
  name: string
  family: string
  description: string
  sfProductId: string
  imageUrl: string
}

export type SellingModelEntry = {
  id: string
  displayName: string
  sfId: string
}

export type ProductCatalog = {
  pageHeader: string
  pageDescription: string
  products: CatalogProduct[]
  sellingModels: SellingModelEntry[]
}

export const DEFAULT_CATALOG: ProductCatalog = {
  pageHeader: 'Product Catalog',
  pageDescription:
    'Browse our selection of products. Click on a product to see detailed specifications, pricing, and more.',
  sellingModels: [],
  products: [],
}
