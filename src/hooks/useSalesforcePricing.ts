import { useEffect, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import { useHeadlessPricingConfig } from '../salesforce/HeadlessPricingConfigContext'
import { buildHeadlessPricingData } from '../salesforce/buildHeadlessPricingData'
import { runHeadlessPricingAction } from '../salesforce/runHeadlessPricingAction'

export type WaterfallStep = {
  name: string
  sequence: number
  adjustmentType: string
  adjustmentAmount: number
  adjustmentPercent?: number
  netUnitPrice: number
}

export type PricingWaterfallRecord = {
  executionId: string
  netUnitPrice: number
  /** Line total (headless: Subtotal tag; RLM/SOQL: netUnitPrice × quantity). */
  subtotal: number
  currencyIsoCode: string
  steps: WaterfallStep[]
}

/** `rlm` = POST /connect/pricing + waterfall; `pricebook_soql` = RLM unavailable (e.g. 404), price from PricebookEntry query; `headless` = runSalesforceHeadlessPricing action */
export type PricingSource = 'rlm' | 'pricebook_soql' | 'headless'

export type SalesforcePricingState =
  | { status: 'loading' }
  | { status: 'ok'; record: PricingWaterfallRecord; raw: unknown; source: PricingSource; headlessAttemptRaw?: unknown }
  | { status: 'error'; error: string; raw?: unknown; headlessAttemptRaw?: unknown }

const API_VERSION = '67.0'

// ---------------------------------------------------------------------------
// RLM Pricing Business API types
// ---------------------------------------------------------------------------

type PricingPostLineItem = {
  pricingProcessExecutionId?: string
  netUnitPrice?: number
  listPrice?: number
  currencyIsoCode?: string
}

type PricingPostResponse = {
  lineItems?: PricingPostLineItem[]
}

type RlmWaterfallItem = {
  name?: string
  sequenceNumber?: number
  pricingElementType?: string
  adjustmentAmount?: number
  adjustmentPercent?: number
  netUnitPrice?: number
}

type PricingWaterfallResponse = {
  pricingLineItems?: {
    netUnitPrice?: number
    currencyIsoCode?: string
    pricingWaterfallItems?: RlmWaterfallItem[]
  }[]
}

// ---------------------------------------------------------------------------
// SOQL fallback types
// ---------------------------------------------------------------------------

type PricebookEntryRow = {
  Id: string
  UnitPrice: number
  CurrencyIsoCode: string
  Pricebook2Id: string
  Pricebook2: { Name: string; IsStandard: boolean }
  ProductSellingModelId?: string | null
  ProductSellingModel?: { Name?: string } | null
}

type SoqlResult = {
  totalSize: number
  records: PricebookEntryRow[]
}

// ---------------------------------------------------------------------------
// Helpers — RLM path
// ---------------------------------------------------------------------------

function mapRlmSteps(items: RlmWaterfallItem[]): WaterfallStep[] {
  return items.map((item, idx) => ({
    name: item.name ?? `Step ${idx + 1}`,
    sequence: item.sequenceNumber ?? idx + 1,
    adjustmentType: item.pricingElementType ?? 'Unknown',
    adjustmentAmount: item.adjustmentAmount ?? 0,
    adjustmentPercent: item.adjustmentPercent ?? undefined,
    netUnitPrice: item.netUnitPrice ?? 0,
  }))
}

async function runRlmPricing(
  apiVersion: string,
  sfProductId: string,
  quantity: number,
  sellingModelId?: string,
): Promise<
  | { ok: true; record: PricingWaterfallRecord; raw: unknown }
  | { ok: false; notFound: boolean; error: string; raw?: unknown }
> {
  const postUrl = `/api/salesforce/services/data/v${apiVersion}/connect/pricing`
  const body: Record<string, unknown> = {
    lineItems: [
      {
        product: { productId: sfProductId },
        quantity,
        currencyIsoCode: 'USD',
        ...(sellingModelId ? { sellingModelId } : {}),
      },
    ],
  }

  const postRes = await fetch(postUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const postRaw: unknown = await postRes.json()

  if (!postRes.ok) {
    const isNotFound =
      postRes.status === 404 ||
      (Array.isArray(postRaw) &&
        (postRaw as { errorCode?: string }[])[0]?.errorCode === 'NOT_FOUND')
    const msg =
      Array.isArray(postRaw) && (postRaw as { message?: string }[])[0]?.message
        ? (postRaw as { message: string }[])[0].message
        : `Pricing POST failed: HTTP ${postRes.status}`
    return { ok: false, notFound: isNotFound, error: msg, raw: postRaw }
  }

  const postData = postRaw as PricingPostResponse
  const firstLineItem = postData.lineItems?.[0]
  const executionId = firstLineItem?.pricingProcessExecutionId

  if (!executionId) {
    return {
      ok: false,
      notFound: false,
      error: 'Pricing API did not return a pricingProcessExecutionId.',
      raw: postRaw,
    }
  }

  // Step 2: fetch the waterfall
  const waterfallUrl =
    `/api/salesforce/services/data/v${apiVersion}/connect/pricing/waterfall/${executionId}`

  const waterfallRes = await fetch(waterfallUrl)
  const waterfallRaw: unknown = await waterfallRes.json()

  if (!waterfallRes.ok) {
    const msg =
      Array.isArray(waterfallRaw) &&
      (waterfallRaw as { message?: string }[])[0]?.message
        ? (waterfallRaw as { message: string }[])[0].message
        : `Waterfall GET failed: HTTP ${waterfallRes.status}`
    return { ok: false, notFound: false, error: msg, raw: waterfallRaw }
  }

  const waterfallData = waterfallRaw as PricingWaterfallResponse
  const firstWaterfallLine = waterfallData.pricingLineItems?.[0]
  const waterfallItems = firstWaterfallLine?.pricingWaterfallItems ?? []

  const netUnitPrice =
    firstWaterfallLine?.netUnitPrice ?? firstLineItem?.netUnitPrice ?? 0
  const currencyIsoCode =
    firstWaterfallLine?.currencyIsoCode ?? firstLineItem?.currencyIsoCode ?? 'USD'

  const steps = mapRlmSteps(waterfallItems)

  // If the waterfall returned no steps, synthesize a minimal one from the POST result
  if (steps.length === 0 && firstLineItem?.netUnitPrice != null) {
    if (firstLineItem.listPrice != null && firstLineItem.listPrice !== firstLineItem.netUnitPrice) {
      steps.push({
        name: 'List Price',
        sequence: 1,
        adjustmentType: 'ListPrice',
        adjustmentAmount: 0,
        netUnitPrice: firstLineItem.listPrice,
      })
      steps.push({
        name: 'Net Unit Price',
        sequence: 2,
        adjustmentType: 'NetPrice',
        adjustmentAmount: firstLineItem.netUnitPrice - firstLineItem.listPrice,
        adjustmentPercent:
          firstLineItem.listPrice !== 0
            ? ((firstLineItem.netUnitPrice - firstLineItem.listPrice) /
                firstLineItem.listPrice) *
              100
            : undefined,
        netUnitPrice: firstLineItem.netUnitPrice,
      })
    } else {
      steps.push({
        name: 'Net Unit Price',
        sequence: 1,
        adjustmentType: 'NetPrice',
        adjustmentAmount: 0,
        netUnitPrice: firstLineItem.netUnitPrice,
      })
    }
  }

  const record: PricingWaterfallRecord = {
    executionId,
    netUnitPrice,
    subtotal: netUnitPrice * quantity,
    currencyIsoCode,
    steps,
  }

  return { ok: true, record, raw: { post: postRaw, waterfall: waterfallRaw } }
}

// ---------------------------------------------------------------------------
// Helpers — SOQL fallback path
// ---------------------------------------------------------------------------

function pickPricebookEntry(
  records: PricebookEntryRow[],
  sellingModelId?: string,
  sellingModelName?: string,
): PricebookEntryRow | undefined {
  if (records.length === 1) return records[0]
  if (sellingModelId) {
    const byId = records.filter((r) => r.ProductSellingModelId === sellingModelId)
    if (byId.length >= 1) return byId[0]
  }
  if (sellingModelName) {
    const byName = records.filter(
      (r) => r.ProductSellingModel?.Name === sellingModelName,
    )
    if (byName.length >= 1) return byName[0]
  }
  return undefined
}

function buildSellingModelWaterfall(
  records: PricebookEntryRow[],
  finalEntry: PricebookEntryRow,
  sellingModelName?: string,
): WaterfallStep[] {
  const steps: WaterfallStep[] = []
  let seq = 1
  const std = records.find((r) => r.Pricebook2.IsStandard)
  const label =
    finalEntry.ProductSellingModel?.Name ?? sellingModelName ?? 'Unit Price'

  if (std && std.Id !== finalEntry.Id) {
    steps.push({
      name: 'List Price',
      sequence: seq++,
      adjustmentType: 'ListPrice',
      adjustmentAmount: 0,
      adjustmentPercent: undefined,
      netUnitPrice: std.UnitPrice,
    })
    const base = std.UnitPrice
    steps.push({
      name: label,
      sequence: seq++,
      adjustmentType: 'SellingModel',
      adjustmentAmount: finalEntry.UnitPrice - base,
      adjustmentPercent:
        base !== 0 ? ((finalEntry.UnitPrice - base) / base) * 100 : undefined,
      netUnitPrice: finalEntry.UnitPrice,
    })
  } else {
    steps.push({
      name: label,
      sequence: seq++,
      adjustmentType: 'SellingModel',
      adjustmentAmount: 0,
      netUnitPrice: finalEntry.UnitPrice,
    })
  }

  return steps
}

function buildLegacyWaterfall(
  records: PricebookEntryRow[],
  finalEntry: PricebookEntryRow,
): WaterfallStep[] {
  const standardEntry = records.find((r) => r.Pricebook2.IsStandard)
  const customEntries = records.filter((r) => !r.Pricebook2.IsStandard)
  const steps: WaterfallStep[] = []
  let sequence = 1

  if (standardEntry) {
    steps.push({
      name: 'List Price',
      sequence: sequence++,
      adjustmentType: 'ListPrice',
      adjustmentAmount: 0,
      adjustmentPercent: undefined,
      netUnitPrice: standardEntry.UnitPrice,
    })
  }

  for (const entry of customEntries) {
    const base = steps[steps.length - 1]?.netUnitPrice ?? entry.UnitPrice
    const adjustmentAmount = entry.UnitPrice - base
    const adjustmentPercent =
      base !== 0 ? ((entry.UnitPrice - base) / base) * 100 : 0
    steps.push({
      name: entry.Pricebook2.Name,
      sequence: sequence++,
      adjustmentType: 'PricebookAdjustment',
      adjustmentAmount,
      adjustmentPercent,
      netUnitPrice: entry.UnitPrice,
    })
  }

  if (steps.length === 1) {
    steps.push({
      name: 'Net Unit Price',
      sequence: sequence++,
      adjustmentType: 'NetPrice',
      adjustmentAmount: 0,
      netUnitPrice: finalEntry.UnitPrice,
    })
  }

  return steps
}

async function queryPricebookEntries(
  apiVersion: string,
  sfProductId: string,
  includeSellingModelName: boolean,
): Promise<{ ok: boolean; data?: SoqlResult; body: unknown; status: number }> {
  const selectFields = [
    'Id',
    'UnitPrice',
    'CurrencyIsoCode',
    'Pricebook2Id',
    'Pricebook2.Name',
    'Pricebook2.IsStandard',
    'ProductSellingModelId',
    ...(includeSellingModelName ? ['ProductSellingModel.Name'] : []),
  ].join(', ')

  const soql = [
    `SELECT ${selectFields}`,
    'FROM PricebookEntry',
    `WHERE Product2Id = '${sfProductId}' AND IsActive = true`,
    'ORDER BY Pricebook2.IsStandard DESC',
  ].join(' ')

  const url =
    `/api/salesforce/services/data/v${apiVersion}/query` +
    `?q=${encodeURIComponent(soql)}`

  const res = await fetch(url)
  const body: unknown = await res.json()
  return { ok: res.ok, data: res.ok ? (body as SoqlResult) : undefined, body, status: res.status }
}

async function runSoqlFallback(
  apiVersion: string,
  sfProductId: string,
  quantity: number,
  sellingModelId?: string,
  sellingModelName?: string,
): Promise<
  | { ok: true; record: PricingWaterfallRecord; raw: unknown }
  | { ok: false; error: string; raw?: unknown }
> {
  let result = await queryPricebookEntries(apiVersion, sfProductId, true)

  if (!result.ok) {
    const errText = JSON.stringify(result.body)
    const retryWithoutName =
      /No such column|INVALID_FIELD|invalid field/i.test(errText) ||
      (Array.isArray(result.body) &&
        (result.body as { errorCode?: string }[])[0]?.errorCode === 'INVALID_FIELD')

    if (retryWithoutName) {
      result = await queryPricebookEntries(apiVersion, sfProductId, false)
    }
  }

  if (!result.ok || !result.data) {
    const body = result.body
    const msg =
      Array.isArray(body) && (body as { message?: string }[])[0]?.message
        ? (body as { message: string }[])[0].message
        : `HTTP ${result.status}`
    return { ok: false, error: msg, raw: body }
  }

  const data = result.data
  if (!data.records || data.records.length === 0) {
    return {
      ok: false,
      error: 'No active PricebookEntry found for this product.',
      raw: data,
    }
  }

  const standardEntry = data.records.find((r) => r.Pricebook2.IsStandard)
  const customEntries = data.records.filter((r) => !r.Pricebook2.IsStandard)

  const picked = pickPricebookEntry(data.records, sellingModelId, sellingModelName)
  const finalEntry = picked ?? customEntries[0] ?? standardEntry ?? data.records[0]

  const useSellingModelWaterfall = picked != null || data.records.length === 1
  const steps = useSellingModelWaterfall
    ? buildSellingModelWaterfall(data.records, finalEntry, sellingModelName)
    : buildLegacyWaterfall(data.records, finalEntry)

  const netUnitPrice = finalEntry.UnitPrice
  return {
    ok: true,
    record: {
      executionId: finalEntry.Id,
      netUnitPrice,
      subtotal: netUnitPrice * quantity,
      currencyIsoCode: finalEntry.CurrencyIsoCode,
      steps,
    },
    raw: data,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSalesforcePricing(
  sfProductId: string,
  quantity: number = 1,
  sellingModelId?: string,
  sellingModelName?: string,
): SalesforcePricingState {
  const { orgInfo } = useSalesforceConfig()
  const apiVersion = orgInfo.apiVersion || API_VERSION
  const { config, isComplete } = useHeadlessPricingConfig()
  const [state, setState] = useState<SalesforcePricingState>({ status: 'loading' })

  useEffect(() => {
    if (!sfProductId) {
      setState({ status: 'error', error: 'No Salesforce product ID provided.' })
      return
    }

    setState({ status: 'loading' })
    let cancelled = false

    async function runPricing() {
      // 0. If headless config is fully set up, try the standard action first
      let headlessAttemptRaw: unknown
      if (isComplete) {
        const pricingData = buildHeadlessPricingData({
          product2Id: sfProductId,
          quantity,
          productSellingModelId: sellingModelId,
          pricebookId: config.pricebookId || undefined,
          startDate: config.effectiveDate.trim() || undefined,
        })
        const headless = await runHeadlessPricingAction(apiVersion, config, pricingData, quantity)
        if (cancelled) return

        if (headless.ok) {
          setState({ status: 'ok', record: headless.record, raw: headless.raw, source: 'headless' })
          return
        }
        headlessAttemptRaw = headless.raw
        // Fall through to RLM / SOQL on any headless failure
      }

      // 1. Try the RLM Pricing Business API
      const rlm = await runRlmPricing(apiVersion, sfProductId, quantity, sellingModelId)
      if (cancelled) return

      if (rlm.ok) {
        setState({ status: 'ok', record: rlm.record, raw: rlm.raw, source: 'rlm', headlessAttemptRaw })
        return
      }

      // 2. If the endpoint simply doesn't exist on this org, fall back to SOQL
      if (rlm.notFound) {
        const soql = await runSoqlFallback(
          apiVersion,
          sfProductId,
          quantity,
          sellingModelId,
          sellingModelName,
        )
        if (cancelled) return

        if (soql.ok) {
          setState({
            status: 'ok',
            record: soql.record,
            raw: soql.raw,
            source: 'pricebook_soql',
            headlessAttemptRaw,
          })
        } else {
          setState({ status: 'error', error: soql.error, raw: soql.raw, headlessAttemptRaw })
        }
        return
      }

      // 3. Any other RLM error — surface it
      setState({ status: 'error', error: rlm.error, raw: rlm.raw, headlessAttemptRaw })
    }

    runPricing().catch((err: unknown) => {
      if (cancelled) return
      setState({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    })

    return () => {
      cancelled = true
    }
  }, [
    sfProductId,
    quantity,
    sellingModelId,
    sellingModelName,
    apiVersion,
    isComplete,
    config,
  ])

  return state
}
