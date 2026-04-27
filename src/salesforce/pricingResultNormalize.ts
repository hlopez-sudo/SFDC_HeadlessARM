// Shared parsing for headless `outputValues.pricingResult` (tagged map or JSON string).

export type PricingResultTaggedValue = {
  value: unknown
  errors: unknown[]
  isSuccess: boolean
  dataPath?: string[]
}

export function normalizePricingResult(
  raw: unknown,
): Record<string, PricingResultTaggedValue[]> {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, PricingResultTaggedValue[]>
      }
      return {}
    } catch {
      return {}
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, PricingResultTaggedValue[]>
  }
  return {}
}

export function isLineItemPath(dataPath?: string[]): boolean {
  if (!Array.isArray(dataPath)) return false
  return dataPath.some((p) => String(p).includes('SalesTransactionItem'))
}
