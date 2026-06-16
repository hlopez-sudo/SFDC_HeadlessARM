// ---------------------------------------------------------------------------
// HeadlessPricingConfig — type, defaults, and localStorage persistence.
//
// NOTE: The `pricingData` JSON structure (SalesTransaction / SalesTransactionItem
// field names) is determined by the context definition / context mapping configured
// in your Salesforce org. The default builder in buildHeadlessPricingData.ts mirrors
// the Revenue Cloud Developer Guide sample. Adjust that file if your mapping uses
// different property names or nesting.
// ---------------------------------------------------------------------------

export type HeadlessPricingConfig = {
  contextDefinitionId: string
  contextMappingId: string
  pricingProcedureId: string
  pricebookId: string
  discoveryProcedure: string
  effectiveDate: string
  quoteStartDate: string
  quoteEndDate: string
  displayContext: boolean
  isHighVolumeLineItems: boolean
  isSkipWaterfall: boolean
  persistContext: boolean
  skipDiscovery: boolean
  taggedData: boolean
  useSessionScopedContext: boolean
}

export const DEFAULT_HEADLESS_PRICING_CONFIG: HeadlessPricingConfig = {
  contextDefinitionId: '',
  contextMappingId: '',
  pricingProcedureId: '',
  pricebookId: '',
  discoveryProcedure: '',
  effectiveDate: '',
  quoteStartDate: '',
  quoteEndDate: '',
  displayContext: false,
  isHighVolumeLineItems: false,
  isSkipWaterfall: false,
  persistContext: false,
  skipDiscovery: true,
  taggedData: false,
  useSessionScopedContext: false,
}

const STORAGE_KEY = 'genericCommerce.headlessPricing'

export function loadHeadlessPricingConfig(): HeadlessPricingConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_HEADLESS_PRICING_CONFIG }
    return { ...DEFAULT_HEADLESS_PRICING_CONFIG, ...(JSON.parse(raw) as Partial<HeadlessPricingConfig>) }
  } catch {
    return { ...DEFAULT_HEADLESS_PRICING_CONFIG }
  }
}

export function saveHeadlessPricingConfig(config: HeadlessPricingConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function isHeadlessPricingConfigComplete(config: HeadlessPricingConfig): boolean {
  return !!(
    config.contextDefinitionId.trim() &&
    config.contextMappingId.trim() &&
    config.pricingProcedureId.trim()
  )
}
