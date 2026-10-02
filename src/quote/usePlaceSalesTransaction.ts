import { useCallback, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import { useHeadlessPricingConfig } from '../salesforce/HeadlessPricingConfigContext'
import {
  entriesForCurrency,
  fetchCurrencyContext,
  pricebookEntryFields,
  resolveHeaderCurrency,
  SINGLE_CURRENCY_CONTEXT,
} from '../salesforce/accountCurrency'
import { extractPstErrorMessage } from '../salesforce/placeSalesTransactionError'
import { resolveQuoteTerm } from '../salesforce/quoteTerm'
import type { QuoteItem } from './QuoteCartContext'

const ACTIVE_ACCOUNT_KEY = 'fc-active-account'

type ActiveAccount = { accountId: string; accountName: string }

function loadActiveAccount(): ActiveAccount | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ACCOUNT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      'accountId' in parsed &&
      typeof (parsed as Record<string, unknown>).accountId === 'string'
    ) {
      return parsed as ActiveAccount
    }
    return null
  } catch {
    return null
  }
}

export type SubmitState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  quoteId: string | null
  error: string | null
  /** Non-blocking notices, e.g. a price book entry missing in the account's currency. */
  warnings?: string[]
  apiResponse?: unknown | null
  requestUrl?: string | null
  requestBody?: unknown | null
}

const IDLE: SubmitState = {
  status: 'idle',
  quoteId: null,
  error: null,
  warnings: [],
  apiResponse: null,
  requestUrl: null,
  requestBody: null,
}

export function usePlaceSalesTransaction() {
  const { orgInfo } = useSalesforceConfig()
  const { config } = useHeadlessPricingConfig()
  const [state, setState] = useState<SubmitState>(IDLE)

  const submit = useCallback(
    async (items: QuoteItem[], quoteName?: string) => {
      if (items.length === 0) return

      // Validate pricebook is configured
      if (!config.pricebookId.trim()) {
        setState({
          status: 'error',
          quoteId: null,
          error: 'Pricebook ID is not configured. Set it in Admin → Salesforce → Headless Pricing Config.',
        })
        return
      }

      setState({ status: 'loading', quoteId: null, error: null })

      const apiVersion = orgInfo.apiVersion || '62.0'
      const account = loadActiveAccount()

      try {
        const currencyCtx = account?.accountId
          ? await fetchCurrencyContext(apiVersion, account.accountId)
          : SINGLE_CURRENCY_CONTEXT

        // Step 1: fetch PricebookEntry IDs for each product
        const productIds = [...new Set(items.map((i) => i.productId))]
        const inClause = productIds.map((id) => `'${id}'`).join(',')
        const soql =
          `SELECT ${pricebookEntryFields(['Id', 'Product2Id', 'ProductSellingModelId'], currencyCtx)} ` +
          `FROM PricebookEntry ` +
          `WHERE Product2Id IN (${inClause}) AND Pricebook2Id = '${config.pricebookId.trim()}' AND IsActive = true`

        const pbRes = await fetch(
          `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(soql)}`,
        )
        if (!pbRes.ok) {
          const body = (await pbRes.json()) as { message?: string }[]
          throw new Error(
            Array.isArray(body) && body[0]?.message
              ? body[0].message
              : `PricebookEntry lookup failed: HTTP ${pbRes.status}`,
          )
        }
        const pbData = (await pbRes.json()) as {
          records: {
            Id: string
            Product2Id: string
            ProductSellingModelId?: string | null
            CurrencyIsoCode?: string | null
          }[]
        }
        // Accumulate all entries per product so the correct one can be chosen by sellingModelId below
        type QuoteEntry = {
          Id: string
          ProductSellingModelId?: string | null
          CurrencyIsoCode?: string | null
        }
        const entryMap = new Map<string, QuoteEntry[]>()
        for (const r of pbData.records ?? []) {
          const existing = entryMap.get(r.Product2Id) ?? []
          existing.push(r)
          entryMap.set(r.Product2Id, existing)
        }

        // Step 2: build the PST graph
        const dateTime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const autoName = account?.accountName
          ? `HeadlessQuote_${account.accountName}_${dateTime}`
          : `HeadlessQuote_${dateTime}`

        // All lines of a Quote share the header currency, and QuoteLineItem.CurrencyIsoCode
        // is not createable — Salesforce derives it from the PricebookEntry — so the
        // currency is decided once here and every line is bound to a matching entry.
        type PreparedLine = { item: QuoteItem; matchedSellingModel: boolean; candidates: QuoteEntry[] }
        const preparedLines: PreparedLine[] = []
        for (const item of items) {
          const entries = entryMap.get(item.productId) ?? []
          if (!entries.length) continue // skip products not in the pricebook
          const bySellingModel = item.sellingModelId
            ? entries.filter((e) => e.ProductSellingModelId === item.sellingModelId)
            : []
          preparedLines.push({
            item,
            matchedSellingModel: bySellingModel.length > 0,
            candidates: bySellingModel.length ? bySellingModel : entries,
          })
        }

        const { currency: quoteCurrency, warnings: currencyWarnings } = resolveHeaderCurrency(
          preparedLines.map((l) => ({ productName: l.item.productName, candidates: l.candidates })),
          currencyCtx,
        )

        // Compute quote line dates — the span drives PricingTermCount, which the pricing
        // procedure uses to scale unit cost, so a degenerate range breaks Margin.
        const { startDate, endDate, warnings: termWarnings } = resolveQuoteTerm({
          quoteStartDate: config.quoteStartDate,
          quoteEndDate: config.quoteEndDate,
        })

        const warnings = [...currencyWarnings, ...termWarnings]
        if (warnings.length) setState((prev) => ({ ...prev, warnings }))

        const quoteRecord: Record<string, unknown> = {
          attributes: { type: 'Quote', method: 'POST' },
          Name: quoteName?.trim() || autoName,
          ...(account?.accountId ? { QuoteAccountId: account.accountId } : {}),
          Pricebook2Id: config.pricebookId.trim(),
          ...(quoteCurrency ? { CurrencyIsoCode: quoteCurrency } : {}),
        }

        const records: unknown[] = [{ referenceId: 'refQuote', record: quoteRecord }]

        let lineIndex = 0
        for (const { item, matchedSellingModel, candidates } of preparedLines) {
          // Pick the PricebookEntry that matches the user's chosen selling model and the
          // quote's currency. Products with multiple entries (one per selling model, and
          // one per currency in multi-currency orgs) require this so Salesforce can derive
          // BillingFrequency from the correct entry.
          const smLower = (item.sellingModel ?? '').toLowerCase()
          const billingPeriod: 'monthly' | 'annual' = smLower.includes('annual') ? 'annual' : 'monthly'
          const inCurrency = entriesForCurrency(candidates, quoteCurrency)
          const selectedEntry =
            !matchedSellingModel && billingPeriod === 'annual' && inCurrency.length > 1
              ? inCurrency[inCurrency.length - 1]
              : inCurrency[0]
          if (!selectedEntry) continue
          const pricebookEntryId = selectedEntry.Id

          const smFields = item.sellingModel ? deriveSellingModelFields(item.sellingModel) : {}
          // Same rules as the order flows: One-Time lines carry no recurring fields, and
          // Evergreen lines have no end.
          const isOneTime = smFields.SellingModelType === 'OneTime'
          const isEvergreen = smFields.SellingModelType === 'Evergreen'
          const lineRecord: Record<string, unknown> = {
            attributes: { type: 'QuoteLineItem', method: 'POST' },
            QuoteId: '@{refQuote.id}',
            Product2Id: item.productId,
            PricebookEntryId: pricebookEntryId,
            ...smFields,
            Quantity: item.quantity,
            StartDate: startDate,
            ...(isOneTime
              ? {}
              : {
                  ...(isEvergreen ? {} : { EndDate: endDate }),
                  PeriodBoundary: 'Anniversary',
                }),
          }

          records.push({ referenceId: `refQuoteLine${lineIndex}`, record: lineRecord })
          lineIndex++
        }

        if (lineIndex === 0) {
          console.error('[PST] No PricebookEntries matched cart products.', {
            requestedProductIds: productIds,
            pricebookId: config.pricebookId.trim(),
          })
          throw new Error(
            'None of the cart products were found in the configured pricebook. Check the Pricebook ID in Admin → Salesforce.',
          )
        }

        const body: Record<string, unknown> = {
          pricingPref: 'Force',
          taxPref: 'Skip',
          graph: { graphId: 'createQuote', records },
        }

        // Step 3: POST to Place Sales Transaction API
        const pstUrl =
          `/api/salesforce/services/data/v${apiVersion}/connect/rev/sales-transaction/actions/place`
        console.log('[PST] Request URL:', pstUrl)
        console.log('[PST] Request body:', JSON.stringify(body, null, 2))

        const pstRes = await fetch(pstUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        console.log('[PST] Response status:', pstRes.status)

        const pstData = (await pstRes.json()) as unknown

        if (!pstRes.ok) {
          console.error('[PST] Response headers:', Object.fromEntries(pstRes.headers))
          console.error('[PST] Error response body:', JSON.stringify(pstData, null, 2))
          throw new Error(extractPstErrorMessage(pstData, pstRes.status))
        }

        console.log('[PST] Response body:', JSON.stringify(pstData, null, 2))

        // Step 4: extract Quote ID from composite graph response
        const quoteId = extractQuoteId(pstData)
        setState({ status: 'success', quoteId, error: null, apiResponse: pstData, requestUrl: pstUrl, requestBody: body })
      } catch (e: unknown) {
        setState({
          status: 'error',
          quoteId: null,
          error: e instanceof Error ? e.message : 'An unexpected error occurred.',
        })
      }
    },
    [orgInfo.apiVersion, config.pricebookId, config.quoteStartDate, config.quoteEndDate],
  )

  const reset = useCallback(() => setState(IDLE), [])

  return { submit, state, reset }
}

function deriveSellingModelFields(name: string): Record<string, string> {
  const lower = name.toLowerCase()
  if (lower.includes('one time') || lower.includes('one-time') || lower.includes('onetime')) {
    return { SellingModelType: 'OneTime' }
  }
  if (lower.includes('term')) {
    return { SellingModelType: 'TermDefined' }
  }
  if (lower.includes('evergreen')) {
    return { SellingModelType: 'Evergreen' }
  }
  return {}
}

function extractQuoteId(data: unknown): string | null {
  // PST response shapes:
  //   flat:      { salesTransactionId, isSuccess, ... }
  //   graphs:    { graphs: [{ graphResponse: { compositeResponse: [...] } }] }
  //   composite: { compositeResponse: [...] }
  try {
    const d = data as Record<string, unknown>

    // Flat response (most common on this org)
    if (typeof d['salesTransactionId'] === 'string' && d['salesTransactionId']) {
      return d['salesTransactionId']
    }

    // Graph / composite response
    const graphs = d['graphs']
    const composite = graphs
      ? ((graphs as { graphResponse?: { compositeResponse?: unknown[] } }[])[0]?.graphResponse
          ?.compositeResponse)
      : (d['compositeResponse'] as unknown[] | undefined)

    if (!Array.isArray(composite)) return null

    for (const entry of composite as { referenceId?: string; body?: { id?: string } }[]) {
      if (entry.referenceId === 'refQuote' && entry.body?.id) {
        return entry.body.id
      }
    }
    return null
  } catch {
    return null
  }
}
