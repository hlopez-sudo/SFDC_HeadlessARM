import { useEffect, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import { fetchCurrencyContext } from '../salesforce/accountCurrency'

export type AssetActionRecord = {
  id: string
  actionDate: string | null
  category: string | null
  quantityChange: number | null
}

export type AssetBilling = {
  periodBoundary: string
  periodBoundaryDay: number | null
  periodBoundaryStartMonth: string | null
  billingFrequency: string | null
}

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
  /** From the most recent order line that changed the asset. */
  billing: AssetBilling | null
  isRamped: boolean
  /** Oldest first. */
  actions: AssetActionRecord[]
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
  const [sources, rampPeriods, actions] = ids
    ? await Promise.all([
        queryAll<SfActionSource>(
          apiVersion,
          `SELECT AssetAction.AssetId, ProductSellingModel.Name, ProductSellingModel.SellingModelType, ` +
            `ProductSellingModel.PricingTermUnit, PricebookEntry.Pricebook2Id, PricebookEntry.IsDerived, UnitPrice, ` +
            `TYPEOF ReferenceEntityItem WHEN OrderItem THEN ` +
            `PeriodBoundary, PeriodBoundaryDay, PeriodBoundaryStartMonth, BillingFrequency2 END ` +
            `FROM AssetActionSource WHERE AssetAction.AssetId IN (${ids}) ` +
            `ORDER BY TransactionDate ASC, CreatedDate ASC`,
        ),
        queryAll<SfStatePeriod>(
          apiVersion,
          `SELECT AssetId FROM AssetStatePeriod WHERE AssetId IN (${ids}) AND RampIdentifier != null`,
        ),
        queryAll<SfAssetAction>(
          apiVersion,
          `SELECT Id, AssetId, ActionDate, toLabel(CategoryEnum), QuantityChange ` +
            `FROM AssetAction WHERE AssetId IN (${ids}) ` +
            `ORDER BY ActionDate ASC, CreatedDate ASC`,
        ),
      ])
    : [[], [], []]

  const firstSource = new Map<string, SfActionSource>()
  const latestPrice = new Map<string, number>()
  const latestBilling = new Map<string, AssetBilling>()
  for (const s of sources) {
    const assetId = s.AssetAction?.AssetId
    if (!assetId) continue
    if (!firstSource.has(assetId)) firstSource.set(assetId, s)
    if (s.UnitPrice != null) latestPrice.set(assetId, s.UnitPrice)
    const line = s.ReferenceEntityItem
    if (line?.PeriodBoundary) {
      latestBilling.set(assetId, {
        periodBoundary: line.PeriodBoundary,
        periodBoundaryDay: line.PeriodBoundaryDay ?? null,
        periodBoundaryStartMonth: line.PeriodBoundaryStartMonth ?? null,
        billingFrequency: line.BillingFrequency2 ?? null,
      })
    }
  }

  const ramped = new Set(rampPeriods.map((p) => p.AssetId))

  const actionsByAsset = new Map<string, AssetActionRecord[]>()
  for (const a of actions) {
    const list = actionsByAsset.get(a.AssetId) ?? []
    list.push({
      id: a.Id,
      actionDate: a.ActionDate ?? null,
      category: a.CategoryEnum ?? null,
      quantityChange: a.QuantityChange ?? null,
    })
    actionsByAsset.set(a.AssetId, list)
  }

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
        billing: latestBilling.get(r.Id) ?? null,
        isRamped: ramped.has(r.Id),
        actions: actionsByAsset.get(r.Id) ?? [],
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
  /** Billing fields are only present when the reference is an OrderItem. */
  ReferenceEntityItem: {
    PeriodBoundary?: string | null
    PeriodBoundaryDay?: number | null
    PeriodBoundaryStartMonth?: string | null
    BillingFrequency2?: string | null
  } | null
}

type SfStatePeriod = {
  AssetId: string
}

type SfAssetAction = {
  Id: string
  AssetId: string
  ActionDate: string | null
  /** Picklist label, via toLabel(). */
  CategoryEnum: string | null
  QuantityChange: number | null
}
