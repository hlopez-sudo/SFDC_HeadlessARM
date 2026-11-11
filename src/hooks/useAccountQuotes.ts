import { useEffect, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'

export type QuoteRecord = {
  id: string
  name: string
  status: string | null
  quoteAccountName: string | null
  totalPrice: number | null
  /** Distinct products across the quote's line items. */
  productNames: string[]
}

type State = { data: QuoteRecord[]; loading: boolean; error: string | null }

export function useAccountQuotes(accountId: string, reloadKey = 0): State {
  const { orgInfo } = useSalesforceConfig()
  const apiVersion = orgInfo.apiVersion || '62.0'
  const [state, setState] = useState<State>({ data: [], loading: false, error: null })

  useEffect(() => {
    if (!accountId) {
      setState({ data: [], loading: false, error: null })
      return
    }

    setState({ data: [], loading: true, error: null })
    let cancelled = false

    async function run() {
      const soql =
        `SELECT Id, Name, Status, QuoteAccount.Name, TotalPrice, ` +
        `(SELECT Product2.Name FROM QuoteLineItems) ` +
        `FROM Quote WHERE QuoteAccountId = '${accountId}' ORDER BY CreatedDate DESC LIMIT 50`
      const res = await fetch(
        `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(soql)}`,
      )
      if (!res.ok) {
        const body = (await res.json()) as { message?: string }[]
        throw new Error(
          Array.isArray(body) && body[0]?.message ? body[0].message : `HTTP ${res.status}`,
        )
      }
      const json = (await res.json()) as { records: SfRecord[] }
      if (!cancelled) {
        setState({
          data: (json.records ?? []).map((r) => ({
            id: r.Id,
            name: r.Name,
            status: r.Status ?? null,
            quoteAccountName: r.QuoteAccount?.Name ?? null,
            totalPrice: r.TotalPrice ?? null,
            productNames: [
              ...new Set((r.QuoteLineItems?.records ?? []).flatMap((l) => l.Product2?.Name ?? [])),
            ],
          })),
          loading: false,
          error: null,
        })
      }
    }

    run().catch((e: unknown) => {
      if (!cancelled) {
        setState({ data: [], loading: false, error: e instanceof Error ? e.message : 'Fetch failed' })
      }
    })

    return () => { cancelled = true }
  }, [accountId, apiVersion, reloadKey])

  return state
}

type SfRecord = {
  Id: string
  Name: string
  Status: string | null
  QuoteAccount: { Name: string } | null
  TotalPrice: number | null
  QuoteLineItems: { records: { Product2: { Name: string } | null }[] } | null
}
