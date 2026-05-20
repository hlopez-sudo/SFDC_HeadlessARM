import { useEffect, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'

export type InvoiceRecord = {
  id: string
  invoiceNumber: string
  status: string
  totalAmount: number
  totalWithTax: number
  balance: number
  invoiceDate: string | null
  dueDate: string | null
}

type State = { data: InvoiceRecord[]; loading: boolean; error: string | null }

export function useAccountInvoices(accountId: string): State {
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
        `SELECT Id, InvoiceNumber, Status, TotalAmount, TotalAmountWithTax, Balance, InvoiceDate, DueDate ` +
        `FROM Invoice WHERE BillingAccountId = '${accountId}' ORDER BY InvoiceDate DESC LIMIT 50`
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
            invoiceNumber: r.InvoiceNumber,
            status: r.Status,
            totalAmount: r.TotalAmount ?? 0,
            totalWithTax: r.TotalAmountWithTax ?? 0,
            balance: r.Balance ?? 0,
            invoiceDate: r.InvoiceDate ?? null,
            dueDate: r.DueDate ?? null,
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
  InvoiceNumber: string
  Status: string
  TotalAmount: number | null
  TotalAmountWithTax: number | null
  Balance: number | null
  InvoiceDate: string | null
  DueDate: string | null
}
