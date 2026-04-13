export type CatalogProduct = {
  id: string
  name: string
  family: string
  description: string
  sfProductId: string
  imageUrl: string
}

export type ProductCatalog = {
  pageHeader: string
  pageDescription: string
  products: CatalogProduct[]
}

export const DEFAULT_CATALOG: ProductCatalog = {
  pageHeader: 'Product Catalog',
  pageDescription:
    'Browse our selection of products. Click on a product to see detailed specifications, pricing, and more.',
  products: [
    {
      id: 'fortigate-7121f',
      name: 'FortiGate 7121F',
      family: 'FortiGate 7000F Series',
      description:
        'The FortiGate 7121F is a high-slot chassis blade for the FortiGate 7000F series, built for data-center scale with massive threat-protection throughput and carrier-class reliability.',
      sfProductId: '01tWt00000CXI9pIAH',
      imageUrl: '',
    },
    {
      id: 'fortigate-7081f',
      name: 'FortiGate 7081F',
      family: 'FortiGate 7000F Series',
      description:
        'The FortiGate 7081F delivers very high threat-protection performance in the FortiGate 7000F family, balancing capacity and footprint for demanding campus-core and data-center environments.',
      sfProductId: '01tWt00000CXI9TIAX',
      imageUrl: '',
    },
  ],
}
