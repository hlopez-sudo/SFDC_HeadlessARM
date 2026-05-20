import { useEffect, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'

export type OrderRecord = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  currencyIsoCode: string
  effectiveDate: string | null
  endDate: string | null
}

type State = { data: OrderRecord[]; loading: boolean; error: string | null }

export function useAccountOrders(accountId: string): State {
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
        `SELECT Id, OrderNumber, Status, TotalAmount, CurrencyIsoCode, EffectiveDate, EndDate ` +
        `FROM Order WHERE AccountId = '${accountId}' ORDER BY CreatedDate DESC LIMIT 50`
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
            orderNumber: r.OrderNumber,
            status: r.Status,
            totalAmount: r.TotalAmount ?? 0,
            currencyIsoCode: r.CurrencyIsoCode ?? 'USD',
            effectiveDate: r.EffectiveDate ?? null,
            endDate: r.EndDate ?? null,
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
  }, [accountId, apiVersion])

  return state
}

type SfRecord = {
  Id: string
  OrderNumber: string
  Status: string
  TotalAmount: number | null
  CurrencyIsoCode: string | null
  EffectiveDate: string | null
  EndDate: string | null
}
