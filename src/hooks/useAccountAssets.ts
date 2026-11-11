import { useEffect, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import { fetchCurrencyContext } from '../salesforce/accountCurrency'

export type AssetRecord = {
  id: string
  name: string
  status: string
  quantity: number | null
  productId: string | null
  productName: string | null
  startDate: string | null
  endDate: string | null
  parentId: string | null
  rootAssetId: string | null
  hasLifecycleManagement: boolean
  usageModelType: string | null
  renewalTerm: number | null
  renewalTermUnit: string | null
  /** Null in single-currency orgs, where Asset has no CurrencyIsoCode field. */
  currencyIsoCode: string | null
  /** From the original sale's AssetActionSource. */
  sellingModelType: string | null
  sellingModelName: string | null
  pricingTermUnit: string | null
  pricebookId: string | null
  isDerivedPrice: boolean
  /** From the most recent AssetActionSource. */
  currentUnitPrice: number | null
  isRamped: boolean
}

type State = {
  data: AssetRecord[]
  isMultiCurrency: boolean
  loading: boolean
  error: string | null
}

const EMPTY: State = { data: [], isMultiCurrency: false, loading: false, error: null }

async function queryAll<T>(apiVersion: string, soql: string): Promise<T[]> {
  const records: T[] = []
  let next: string | null = `/services/data/v${apiVersion}/query?q=${encodeURIComponent(soql)}`
  while (next) {
    const res = await fetch(`/api/salesforce${next}`)
    if (!res.ok) {
      const body = (await res.json()) as { message?: string }[]
      throw new Error(Array.isArray(body) && body[0]?.message ? body[0].message : `HTTP ${res.status}`)
    }
    const json = (await res.json()) as { records?: T[]; nextRecordsUrl?: string }
    records.push(...(json.records ?? []))
    next = json.nextRecordsUrl ?? null
  }
  return records
}

export async function fetchAccountAssets(
  apiVersion: string,
  accountId: string,
): Promise<{ data: AssetRecord[]; isMultiCurrency: boolean }> {
  const currencyCtx = await fetchCurrencyContext(apiVersion, accountId)

  const assetFields = [
    'Id', 'Name', 'Status', 'CurrentQuantity', 'Product2Id', 'Product2.Name', 'Product2.UsageModelType',
    'LifecycleStartDate', 'LifecycleEndDate', 'HasLifecycleManagement', 'RenewalTerm', 'RenewalTermUnit',
    'ParentId', 'RootAssetId',
    ...(currencyCtx.isMultiCurrency ? ['CurrencyIsoCode'] : []),
  ]
  const assets = await queryAll<SfAsset>(
    apiVersion,
    `SELECT ${assetFields.join(', ')} FROM Asset WHERE AccountId = '${accountId}' ` +
      `ORDER BY CreatedDate DESC LIMIT 50`,
  )

  const ids = assets.map((a) => `'${a.Id}'`).join(',')
  const [sources, rampPeriods] = ids
    ? await Promise.all([
        queryAll<SfActionSource>(
          apiVersion,
          `SELECT AssetAction.AssetId, ProductSellingModel.Name, ProductSellingModel.SellingModelType, ` +
            `ProductSellingModel.PricingTermUnit, PricebookEntry.Pricebook2Id, PricebookEntry.IsDerived, UnitPrice ` +
            `FROM AssetActionSource WHERE AssetAction.AssetId IN (${ids}) ` +
            `ORDER BY TransactionDate ASC, CreatedDate ASC`,
        ),
        queryAll<SfStatePeriod>(
          apiVersion,
          `SELECT AssetId FROM AssetStatePeriod WHERE AssetId IN (${ids}) AND RampIdentifier != null`,
        ),
      ])
    : [[], []]

  const firstSource = new Map<string, SfActionSource>()
  const latestPrice = new Map<string, number>()
  for (const s of sources) {
    const assetId = s.AssetAction?.AssetId
    if (!assetId) continue
    if (!firstSource.has(assetId)) firstSource.set(assetId, s)
    if (s.UnitPrice != null) latestPrice.set(assetId, s.UnitPrice)
  }

  const ramped = new Set(rampPeriods.map((p) => p.AssetId))

  return {
    data: assets.map((r) => {
      const source = firstSource.get(r.Id)
      return {
        id: r.Id,
        name: r.Name,
        status: r.Status,
        quantity: r.CurrentQuantity ?? null,
        productId: r.Product2Id ?? null,
        productName: r.Product2?.Name ?? null,
        startDate: r.LifecycleStartDate ?? null,
        endDate: r.LifecycleEndDate ?? null,
        parentId: r.ParentId ?? null,
        rootAssetId: r.RootAssetId ?? null,
        hasLifecycleManagement: Boolean(r.HasLifecycleManagement),
        usageModelType: r.Product2?.UsageModelType ?? null,
        renewalTerm: r.RenewalTerm ?? null,
        renewalTermUnit: r.RenewalTermUnit ?? null,
        currencyIsoCode: r.CurrencyIsoCode ?? null,
        sellingModelType: source?.ProductSellingModel?.SellingModelType ?? null,
        sellingModelName: source?.ProductSellingModel?.Name ?? null,
        pricingTermUnit: source?.ProductSellingModel?.PricingTermUnit ?? null,
        pricebookId: source?.PricebookEntry?.Pricebook2Id ?? null,
        isDerivedPrice: Boolean(source?.PricebookEntry?.IsDerived),
        currentUnitPrice: latestPrice.get(r.Id) ?? null,
        isRamped: ramped.has(r.Id),
      }
    }),
    isMultiCurrency: currencyCtx.isMultiCurrency,
  }
}

export function useAccountAssets(accountId: string, reloadKey = 0): State {
  const { orgInfo } = useSalesforceConfig()
  const apiVersion = orgInfo.apiVersion
  const [state, setState] = useState<State>(EMPTY)

  useEffect(() => {
    if (!accountId) {
      setState(EMPTY)
      return
    }

    setState({ ...EMPTY, loading: true })
    let cancelled = false

    async function run() {
      const result = await fetchAccountAssets(apiVersion, accountId)
      if (!cancelled) setState({ ...result, loading: false, error: null })
    }

    run().catch((e: unknown) => {
      if (!cancelled) {
        setState({ ...EMPTY, error: e instanceof Error ? e.message : 'Fetch failed' })
      }
    })

    return () => { cancelled = true }
  }, [accountId, apiVersion, reloadKey])

  return state
}

type SfAsset = {
  Id: string
  Name: string
  Status: string
  CurrentQuantity: number | null
  Product2Id: string | null
  Product2: { Name: string; UsageModelType: string | null } | null
  LifecycleStartDate: string | null
  LifecycleEndDate: string | null
  HasLifecycleManagement: boolean | null
  RenewalTerm: number | null
  RenewalTermUnit: string | null
  ParentId: string | null
  RootAssetId: string | null
  CurrencyIsoCode?: string | null
}

type SfActionSource = {
  AssetAction: { AssetId: string } | null
  ProductSellingModel: { Name: string; SellingModelType: string; PricingTermUnit: string | null } | null
  PricebookEntry: { Pricebook2Id: string; IsDerived: boolean | null } | null
  UnitPrice: number | null
}

type SfStatePeriod = {
  AssetId: string
}
