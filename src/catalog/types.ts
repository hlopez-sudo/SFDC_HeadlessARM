export type CatalogProduct = {
  id: string
  name: string
  family: string
  description: string
  sfProductId: string
  imageUrl: string
}

export type ProductCategoryEntry = {
  id: string
  displayName: string
  sfId: string
}

export type SellingModelEntry = {
  id: string
  displayName: string
  sfId: string
}

export type ProductCatalog = {
  pageHeader: string
  pageDescription: string
  productCategories: ProductCategoryEntry[]
  sellingModels: SellingModelEntry[]
  products: CatalogProduct[]
}

export const DEFAULT_CATALOG: ProductCatalog = {
  pageHeader: 'Product Catalog',
  pageDescription:
    'Browse our selection of products. Click on a product to see detailed specifications, pricing, and more.',
  productCategories: [],
  sellingModels: [],
  products: [],
}
