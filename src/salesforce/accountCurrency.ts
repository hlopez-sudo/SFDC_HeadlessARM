// ---------------------------------------------------------------------------
// accountCurrency — resolves the Account Currency (Account.CurrencyIsoCode) and
// matches price book entries to it.
//
// In a multi-currency org the Standard Price Book holds one PricebookEntry per
// currency per selling model, and Salesforce derives OrderItem/QuoteLineItem
// CurrencyIsoCode from the entry (those line fields are not createable). Picking
// an entry in a currency other than the header's fails with
// FIELD_INTEGRITY_EXCEPTION "Enter the same currency as the parent Order."
// So: stamp the currency on the Order/Quote header, and bind every line to an
// entry in that same currency.
// ---------------------------------------------------------------------------

export type CurrencyContext = {
  /** Account Currency of the active account; null in single-currency orgs. */
  accountCurrency: string | null
  /** Org corporate currency, used as the fallback; null in single-currency orgs. */
  corporateCurrency: string | null
  /** False when the org has no CurrencyIsoCode field (single-currency). */
  isMultiCurrency: boolean
}

export const SINGLE_CURRENCY_CONTEXT: CurrencyContext = {
  accountCurrency: null,
  corporateCurrency: null,
  isMultiCurrency: false,
}

/** Minimal shape of the PricebookEntry rows the order/quote flows query. */
export type CurrencyPricebookEntry = {
  Id: string
  CurrencyIsoCode?: string | null
}

/**
 * Looks up the account's currency plus the org's corporate currency. Single-currency
 * orgs have no CurrencyIsoCode field at all, so a failed lookup degrades to
 * "currency is not a concern here" and the flows behave as they did before.
 */
export async function fetchCurrencyContext(
  apiVersion: string,
  accountId: string,
): Promise<CurrencyContext> {
  const base = `/api/salesforce/services/data/v${apiVersion}/query?q=`

  let accountCurrency: string | null = null
  try {
    const soql = `SELECT CurrencyIsoCode FROM Account WHERE Id = '${accountId}'`
    const res = await fetch(base + encodeURIComponent(soql))
    if (!res.ok) return SINGLE_CURRENCY_CONTEXT
    const body = (await res.json()) as { records?: { CurrencyIsoCode?: string | null }[] }
    accountCurrency = body.records?.[0]?.CurrencyIsoCode ?? null
  } catch {
    return SINGLE_CURRENCY_CONTEXT
  }

  if (!accountCurrency) return SINGLE_CURRENCY_CONTEXT

  let corporateCurrency: string | null = null
  try {
    const soql = `SELECT IsoCode FROM CurrencyType WHERE IsCorporate = true AND IsActive = true LIMIT 1`
    const res = await fetch(base + encodeURIComponent(soql))
    if (res.ok) {
      const body = (await res.json()) as { records?: { IsoCode?: string | null }[] }
      corporateCurrency = body.records?.[0]?.IsoCode ?? null
    }
  } catch {
    /* non-fatal — fall back to the account currency alone */
  }

  return { accountCurrency, corporateCurrency, isMultiCurrency: true }
}

/** SELECT fields for a PricebookEntry query, including currency only when the org has it. */
export function pricebookEntryFields(fields: string[], ctx: CurrencyContext): string {
  return (ctx.isMultiCurrency ? [...fields, 'CurrencyIsoCode'] : fields).join(', ')
}

function entriesInCurrency<T extends CurrencyPricebookEntry>(
  candidates: T[],
  currency: string | null,
): T[] {
  if (!currency) return []
  return candidates.filter((r) => r.CurrencyIsoCode === currency)
}

/**
 * The candidates usable for the header currency, preserving query order so callers
 * can keep applying their own price-based heuristics within a single currency.
 * Returns every candidate in single-currency orgs.
 */
export function entriesForCurrency<T extends CurrencyPricebookEntry>(
  candidates: T[],
  currency: string | null,
): T[] {
  if (!currency) return candidates
  return entriesInCurrency(candidates, currency)
}

/**
 * Picks the currency the whole header should use. All lines of an Order/Quote share
 * one currency, so the account currency is only used when every product has an entry
 * in it; otherwise the org's corporate currency takes over and the affected products
 * are reported back as warnings.
 */
export function resolveHeaderCurrency<T extends CurrencyPricebookEntry>(
  lines: { productName: string; candidates: T[] }[],
  ctx: CurrencyContext,
): { currency: string | null; warnings: string[] } {
  if (!ctx.isMultiCurrency || !ctx.accountCurrency) return { currency: null, warnings: [] }

  const missing = lines.filter((l) => entriesInCurrency(l.candidates, ctx.accountCurrency).length === 0)
  if (missing.length === 0) return { currency: ctx.accountCurrency, warnings: [] }

  const fallback = ctx.corporateCurrency
  if (!fallback || fallback === ctx.accountCurrency) {
    throw new Error(
      `No ${ctx.accountCurrency} price book entry for ${missing.map((l) => l.productName).join(', ')}. ` +
        `Add an entry in the account's currency or choose a different account.`,
    )
  }

  const stillMissing = missing.filter((l) => entriesInCurrency(l.candidates, fallback).length === 0)
  if (stillMissing.length) {
    throw new Error(
      `No ${ctx.accountCurrency} or ${fallback} price book entry for ` +
        `${stillMissing.map((l) => l.productName).join(', ')}. Check the pricebook setup in Salesforce.`,
    )
  }

  return {
    currency: fallback,
    warnings: missing.map(
      (l) =>
        `No ${ctx.accountCurrency} price book entry for ${l.productName} — ` +
        `using ${fallback} (org currency) instead.`,
    ),
  }
}
