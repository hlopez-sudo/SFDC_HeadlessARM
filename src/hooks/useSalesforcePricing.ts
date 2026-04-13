import { useEffect, useState } from 'react'

export type PricebookEntryRecord = {
  Id: string
  UnitPrice: number
  CurrencyIsoCode: string
  Pricebook2Id: string
  Pricebook2: { Name: string }
}

export type SalesforcePricingState =
  | { status: 'loading' }
  | { status: 'ok'; record: PricebookEntryRecord; raw: unknown }
  | { status: 'error'; error: string; raw?: unknown }

const API_VERSION = '67.0'

export function useSalesforcePricing(sfProductId: string): SalesforcePricingState {
  const [state, setState] = useState<SalesforcePricingState>({ status: 'loading' })

  useEffect(() => {
    if (!sfProductId) {
      setState({ status: 'error', error: 'No Salesforce product ID provided.' })
      return
    }

    setState({ status: 'loading' })
    let cancelled = false

    const soql = [
      'SELECT Id, UnitPrice, CurrencyIsoCode, Pricebook2Id, Pricebook2.Name',
      `FROM PricebookEntry`,
      `WHERE Product2Id = '${sfProductId}' AND IsActive = true`,
    ].join(' ')

    const url =
      `/api/salesforce/services/data/v${API_VERSION}/query` +
      `?q=${encodeURIComponent(soql)}`

    fetch(url)
      .then(async (res) => {
        const body: unknown = await res.json()
        if (cancelled) return
        if (!res.ok) {
          const msg =
            Array.isArray(body) && (body as { message?: string }[])[0]?.message
              ? (body as { message: string }[])[0].message
              : `HTTP ${res.status}`
          setState({ status: 'error', error: msg, raw: body })
          return
        }
        const data = body as { totalSize: number; records: unknown[] }
        if (!data.records || data.records.length === 0) {
          setState({
            status: 'error',
            error: 'No active PricebookEntry found for this product.',
            raw: body,
          })
          return
        }
        const record = data.records[0] as PricebookEntryRecord
        setState({ status: 'ok', record, raw: body })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      })

    return () => {
      cancelled = true
    }
  }, [sfProductId])

  return state
}
