import { useEffect, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'

export type AssetRecord = {
  id: string
  name: string
  status: string
  quantity: number | null
  productName: string | null
  startDate: string | null
  endDate: string | null
}

type State = { data: AssetRecord[]; loading: boolean; error: string | null }

export function useAccountAssets(accountId: string): State {
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
        `SELECT Id, Name, Status, CurrentQuantity, Product2.Name, LifecycleStartDate, LifecycleEndDate ` +
        `FROM Asset WHERE AccountId = '${accountId}' ORDER BY CreatedDate DESC LIMIT 50`
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
            status: r.Status,
            quantity: r.CurrentQuantity ?? null,
            productName: r.Product2?.Name ?? null,
            startDate: r.LifecycleStartDate ?? null,
            endDate: r.LifecycleEndDate ?? null,
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
  Name: string
  Status: string
  CurrentQuantity: number | null
  Product2: { Name: string } | null
  LifecycleStartDate: string | null
  LifecycleEndDate: string | null
}
