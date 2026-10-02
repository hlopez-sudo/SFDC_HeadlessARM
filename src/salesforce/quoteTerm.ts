// ---------------------------------------------------------------------------
// quoteTerm — resolves the StartDate / EndDate span for QuoteLineItems.
//
// The span matters beyond the dates themselves: Salesforce derives
// PricingTermCount from it (term length over the selling model's pricing term)
// and divides the unit cost by that figure. A one-day span yields 1/365, which
// multiplies the cost by 365 and pushes Margin — a percent(5,2) field — past its
// 999.99 ceiling, failing the whole transaction with NUMBER_OUTSIDE_VALID_RANGE.
// ---------------------------------------------------------------------------

import type { HeadlessPricingConfig } from './headlessPricingConfig'

export type QuoteTerm = {
  startDate: string
  endDate: string
  /** Populated when a configured end date was unusable and had to be replaced. */
  warnings: string[]
}

/** One year minus a day, so a standard term lands on PricingTermCount = 1. */
function oneYearTerm(startDate: string): string {
  const d = new Date(startDate)
  d.setFullYear(d.getFullYear() + 1)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export function resolveQuoteTerm(
  config: Pick<HeadlessPricingConfig, 'quoteStartDate' | 'quoteEndDate'>,
): QuoteTerm {
  const today = new Date().toISOString().split('T')[0]
  const startDate = config.quoteStartDate.trim() || today
  const configuredEnd = config.quoteEndDate.trim()
  const defaultEnd = oneYearTerm(startDate)

  if (!configuredEnd) return { startDate, endDate: defaultEnd, warnings: [] }

  if (configuredEnd > startDate) return { startDate, endDate: configuredEnd, warnings: [] }

  return {
    startDate,
    endDate: defaultEnd,
    warnings: [
      `Configured quoteEndDate (${configuredEnd}) is not after quoteStartDate (${startDate}) — ` +
        `using ${defaultEnd} instead. Fix the dates in Admin → Salesforce.`,
    ],
  }
}
