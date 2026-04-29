export type CategoryId = 'data-center' | 'campus' | 'branch' | 'fgaas'

export type ProductModel = {
  slug: string
  name: string
  threatProtection: string
  categoryId: CategoryId
  hasVideo: boolean
  /** Only FortiGate 7121F and 7081F navigate to in-app detail */
  hasDetailPage: boolean
}

export const categories: {
  id: CategoryId
  label: string
  shortLabel: string
}[] = [
  { id: 'data-center', label: 'High-End (Data Center)', shortLabel: 'Data Center' },
  { id: 'campus', label: 'Mid-Range (Campus)', shortLabel: 'Campus' },
  { id: 'branch', label: 'Entry-Level (Branch)', shortLabel: 'Branch' },
  { id: 'fgaas', label: 'FortiGate-as-a-Service', shortLabel: 'FGaaS' },
]

export const productModels: ProductModel[] = [
  // High-End (Data Center)
  {
    slug: 'fortigate-7121f',
    name: 'FortiGate 7121F',
    threatProtection: '520 Gbps',
    categoryId: 'data-center',
    hasVideo: true,
    hasDetailPage: true,
  },
  {
    slug: 'fortigate-7081f',
    name: 'FortiGate 7081F',
    threatProtection: '312 Gbps',
    categoryId: 'data-center',
    hasVideo: false,
    hasDetailPage: true,
  },
  {
    slug: 'fortigate-4800f',
    name: 'FortiGate 4800F',
    threatProtection: '70 Gbps',
    categoryId: 'data-center',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-4400f',
    name: 'FortiGate 4400F',
    threatProtection: '75 Gbps',
    categoryId: 'data-center',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-4200f',
    name: 'FortiGate 4200F',
    threatProtection: '45 Gbps',
    categoryId: 'data-center',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-3800g',
    name: 'FortiGate 3800G',
    threatProtection: '200 Gbps',
    categoryId: 'data-center',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-3700f',
    name: 'FortiGate 3700F',
    threatProtection: '75 Gbps',
    categoryId: 'data-center',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-3500f',
    name: 'FortiGate 3500F',
    threatProtection: '63 Gbps',
    categoryId: 'data-center',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-3200f',
    name: 'FortiGate 3200F',
    threatProtection: '45 Gbps',
    categoryId: 'data-center',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-3000g',
    name: 'FortiGate 3000G',
    threatProtection: '90 Gbps',
    categoryId: 'data-center',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-3000f',
    name: 'FortiGate 3000F',
    threatProtection: '33 Gbps',
    categoryId: 'data-center',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-2600f',
    name: 'FortiGate 2600F',
    threatProtection: '25 Gbps',
    categoryId: 'data-center',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-1800f',
    name: 'FortiGate 1800F',
    threatProtection: '15 Gbps',
    categoryId: 'data-center',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-1000f',
    name: 'FortiGate 1000F',
    threatProtection: '13 Gbps',
    categoryId: 'data-center',
    hasVideo: false,
    hasDetailPage: false,
  },
  // Mid-Range (Campus)
  {
    slug: 'fortigate-900g',
    name: 'FortiGate 900G',
    threatProtection: '30 Gbps',
    categoryId: 'campus',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-700g',
    name: 'FortiGate 700G',
    threatProtection: '26 Gbps',
    categoryId: 'campus',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-600f',
    name: 'FortiGate 600F',
    threatProtection: '10.5 Gbps',
    categoryId: 'campus',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-400f',
    name: 'FortiGate 400F',
    threatProtection: '9 Gbps',
    categoryId: 'campus',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-200g',
    name: 'FortiGate 200G',
    threatProtection: '6 Gbps',
    categoryId: 'campus',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-120g',
    name: 'FortiGate 120G',
    threatProtection: '2.8 Gbps',
    categoryId: 'campus',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-100f',
    name: 'FortiGate 100F',
    threatProtection: '1 Gbps',
    categoryId: 'campus',
    hasVideo: false,
    hasDetailPage: false,
  },
  // Entry-Level (Branch)
  {
    slug: 'fortigate-90g',
    name: 'FortiGate 90G',
    threatProtection: '2.2 Gbps',
    categoryId: 'branch',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-80f',
    name: 'FortiGate 80F',
    threatProtection: '900 Mbps',
    categoryId: 'branch',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-70g',
    name: 'FortiGate 70G',
    threatProtection: '1.3 Gbps',
    categoryId: 'branch',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-70f',
    name: 'FortiGate 70F',
    threatProtection: '800 Mbps',
    categoryId: 'branch',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-60f',
    name: 'FortiGate 60F',
    threatProtection: '700 Mbps',
    categoryId: 'branch',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-50g',
    name: 'FortiGate 50G',
    threatProtection: '1.1 Gbps',
    categoryId: 'branch',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-40f',
    name: 'FortiGate 40F',
    threatProtection: '600 Mbps',
    categoryId: 'branch',
    hasVideo: true,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-30g',
    name: 'FortiGate 30G',
    threatProtection: '500 Mbps',
    categoryId: 'branch',
    hasVideo: true,
    hasDetailPage: false,
  },
  // FortiGate-as-a-Service
  {
    slug: 'fortigate-91g',
    name: 'FortiGate 91G',
    threatProtection: '2.2 Gbps',
    categoryId: 'fgaas',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-901g',
    name: 'FortiGate 901G',
    threatProtection: '20 Gbps',
    categoryId: 'fgaas',
    hasVideo: false,
    hasDetailPage: false,
  },
  {
    slug: 'fortigate-3501f',
    name: 'FortiGate 3501F',
    threatProtection: '63 Gbps',
    categoryId: 'fgaas',
    hasVideo: true,
    hasDetailPage: false,
  },
]

const detailSlugs = new Set(
  productModels.filter((m) => m.hasDetailPage).map((m) => m.slug),
)

export function isDetailSlug(slug: string): boolean {
  return detailSlugs.has(slug)
}

export function getProductModelBySlug(slug: string): ProductModel | undefined {
  return productModels.find((m) => m.slug === slug)
}

export function getProductModelsByCategory(categoryId: CategoryId): ProductModel[] {
  return productModels.filter((m) => m.categoryId === categoryId)
}

export type ModelDetailContent = {
  slug: string
  name: string
  threatProtection: string
  /** Demo unit price in USD; used as fallback when Salesforce data is unavailable */
  unitPriceUsd: number
  /** Salesforce Product2 Id — used by useSalesforcePricing to fetch live PricebookEntry */
  sfProductId: string
  summary: string
  highlights: string[]
  specs: { label: string; value: string }[]
}

export const modelDetailsBySlug: Record<string, ModelDetailContent> = {
  'fortigate-7121f': {
    slug: 'fortigate-7121f',
    name: 'FortiGate 7121F',
    threatProtection: '520 Gbps',
    unitPriceUsd: 124999.99,
    sfProductId: '01tWt00000CXI9pIAH',
    summary:
      'The FortiGate 7121F is a high-slot chassis blade for the FortiGate 7000F series, built for data-center scale with massive threat-protection throughput and carrier-class reliability.',
    highlights: [
      'Designed for the FortiGate 7000F modular platform with flexible slot configuration',
      'Ideal for service providers and large enterprises that need elastic performance at the core',
      'Runs FortiOS with unified security and networking services in a single policy model',
    ],
    specs: [
      { label: 'Threat protection (reference)', value: '520 Gbps' },
      { label: 'Form factor', value: '7000F series blade / chassis slot' },
      { label: 'Typical deployment', value: 'Data center, service provider edge' },
    ],
  },
  'fortigate-7081f': {
    slug: 'fortigate-7081f',
    name: 'FortiGate 7081F',
    threatProtection: '312 Gbps',
    unitPriceUsd: 98999.99,
    sfProductId: '01tWt00000CXI9TIAX',
    summary:
      'The FortiGate 7081F delivers very high threat-protection performance in the FortiGate 7000F family, balancing capacity and footprint for demanding campus-core and data-center environments.',
    highlights: [
      '7000F-series architecture for modular scale and investment protection',
      'Consistent FortiOS experience across form factors for simpler operations',
      'Strong fit when you need headroom for SSL inspection and advanced services',
    ],
    specs: [
      { label: 'Threat protection (reference)', value: '312 Gbps' },
      { label: 'Form factor', value: '7000F series blade / chassis slot' },
      { label: 'Typical deployment', value: 'High-end campus core, data center' },
    ],
  },
}
