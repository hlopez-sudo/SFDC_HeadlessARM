import { useCallback, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import { useHeadlessPricingConfig } from '../salesforce/HeadlessPricingConfigContext'
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
}

const IDLE: SubmitState = { status: 'idle', quoteId: null, error: null }

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
        // Step 1: fetch PricebookEntry IDs for each product
        const productIds = [...new Set(items.map((i) => i.productId))]
        const inClause = productIds.map((id) => `'${id}'`).join(',')
        const soql =
          `SELECT Id, Product2Id FROM PricebookEntry ` +
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
        const pbData = (await pbRes.json()) as { records: { Id: string; Product2Id: string }[] }
        const entryMap = new Map<string, string>()
        for (const r of pbData.records ?? []) {
          entryMap.set(r.Product2Id, r.Id)
        }

        // Step 2: build the PST graph
        const today = new Date().toISOString().split('T')[0]
        const autoName = account?.accountName
          ? `Quote - ${account.accountName} - ${today}`
          : `Quote - ${today}`

        const quoteRecord: Record<string, unknown> = {
          attributes: { type: 'Quote', method: 'POST' },
          Name: quoteName?.trim() || autoName,
          Pricebook2Id: config.pricebookId.trim(),
        }
        // AccountId omitted — not writable on Quote for this org's permission set

        const records: unknown[] = [{ referenceId: 'refQuote', record: quoteRecord }]

        // Compute quote line dates — required for term/subscription selling models
        const startDate = config.quoteStartDate.trim() || today
        const endDate = (() => {
          if (config.quoteEndDate.trim()) return config.quoteEndDate.trim()
          const d = new Date(startDate)
          d.setFullYear(d.getFullYear() + 1)
          return d.toISOString().split('T')[0]
        })()

        let lineIndex = 0
        for (const item of items) {
          const pricebookEntryId = entryMap.get(item.productId)
          if (!pricebookEntryId) continue // skip products not in the pricebook

          const lineRecord: Record<string, unknown> = {
            attributes: { type: 'QuoteLineItem', method: 'POST' },
            QuoteId: '@{refQuote.id}',
            Product2Id: item.productId,
            PricebookEntryId: pricebookEntryId,
            Quantity: item.quantity,
            StartDate: startDate,
            EndDate: endDate,
            // UnitPrice omitted — Force pricing looks it up from the Pricebook
          }
          if (item.sellingModelId) lineRecord.ProductSellingModelId = item.sellingModelId

          records.push({ referenceId: `refQuoteLine${lineIndex}`, record: lineRecord })
          lineIndex++
        }

        if (lineIndex === 0) {
          throw new Error(
            'None of the cart products were found in the configured pricebook. Check the Pricebook ID in Admin → Salesforce.',
          )
        }

        const body: Record<string, unknown> = {
          pricingPref: 'Force',  // let Salesforce price from the Pricebook
          taxPref: 'Skip',
          graph: { graphId: 'createQuote', records },
          // contextDetails omitted — not needed when graph is provided;
          // contextMappingId is a record ID, not a session UUID
        }

        // Step 3: POST to Place Sales Transaction API
        const pstRes = await fetch(
          `/api/salesforce/services/data/v${apiVersion}/connect/rev/sales-transaction/actions/place`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        )

        const pstData = (await pstRes.json()) as unknown

        if (!pstRes.ok) {
          console.error('[PST] Error response body:', JSON.stringify(pstData, null, 2))
          let msg = `Request failed: HTTP ${pstRes.status}`
          if (Array.isArray(pstData) && (pstData[0] as { message?: string })?.message) {
            msg = (pstData[0] as { message: string }).message
          } else if (
            pstData &&
            typeof pstData === 'object' &&
            (pstData as { message?: string }).message
          ) {
            msg = (pstData as { message: string }).message
          }
          throw new Error(msg)
        }

        // Step 4: extract Quote ID from composite graph response
        const quoteId = extractQuoteId(pstData)
        setState({ status: 'success', quoteId, error: null })
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

function extractQuoteId(data: unknown): string | null {
  // PST response: { graphs: [{ graphId, isSuccessful, graphResponse: { compositeResponse: [...] } }] }
  // or direct: { compositeResponse: [...] }
  try {
    const d = data as Record<string, unknown>

    // Unwrap graphs array if present
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
