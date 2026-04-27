import type { HeadlessPricingConfig } from './headlessPricingConfig'
import type { PricingWaterfallRecord } from '../hooks/useSalesforcePricing'
import { getFinalHeadlessWaterfallPrices } from './parseHeadlessPricingWaterfall'
import {
  isLineItemPath,
  normalizePricingResult,
  type PricingResultTaggedValue,
} from './pricingResultNormalize'

// ---------------------------------------------------------------------------
// Response types for the invocable action envelope
// ---------------------------------------------------------------------------

type HeadlessActionResult = {
  actionName?: string
  errors?: unknown
  isSuccess: boolean
  outputValues?: {
    executionId?: string
    pricingProcessStatus?: string
    pricingProcessErrors?: unknown
    /** May be a JSON object or a stringified JSON object from the API */
    pricingResult?: unknown
    contextDetails?: unknown
  }
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

export async function runHeadlessPricingAction(
  apiVersion: string,
  config: HeadlessPricingConfig,
  pricingDataObject: Record<string, unknown>,
  quantity: number,
): Promise<
  | { ok: true; record: PricingWaterfallRecord; raw: unknown }
  | { ok: false; error: string; raw?: unknown }
> {
  const url =
    `/api/salesforce/services/data/v${apiVersion}/actions/standard/runSalesforceHeadlessPricing`

  const input: Record<string, unknown> = {
    contextDefinitionId: config.contextDefinitionId,
    contextMappingId: config.contextMappingId,
    pricingProcedureId: config.pricingProcedureId,
    pricingData: JSON.stringify(pricingDataObject),
    displayContext: config.displayContext,
    isHighVolumeLineItems: config.isHighVolumeLineItems,
    isSkipWaterfall: config.isSkipWaterfall,
    persistContext: config.persistContext,
    skipDiscovery: config.skipDiscovery,
    taggedData: config.taggedData,
    useSessionScopedContext: config.useSessionScopedContext,
  }

  if (config.discoveryProcedure.trim()) input.discoveryProcedure = config.discoveryProcedure.trim()
  if (config.effectiveDate.trim()) input.effectiveDate = config.effectiveDate.trim()

  let raw: unknown
  let res: Response

  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: [input] }),
    })
    const text = await res.text()
    try {
      raw = text ? (JSON.parse(text) as unknown) : null
    } catch {
      return {
        ok: false,
        error: `HTTP ${res.status}: response was not JSON`,
        raw: text.slice(0, 500),
      }
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  if (!res.ok) {
    const errMsg =
      extractInvocableActionErrorBody(raw) ??
      extractErrorMsg(raw) ??
      `HTTP ${res.status}`
    return { ok: false, error: errMsg, raw }
  }

  // The invocable action wraps results in an array (one entry per input sent).
  const result: HeadlessActionResult = Array.isArray(raw)
    ? (raw as HeadlessActionResult[])[0]
    : (raw as HeadlessActionResult)

  if (!result?.isSuccess) {
    const msg =
      extractInvocableActionErrorBody(raw) ??
      extractErrorMsg(result?.errors) ??
      result?.outputValues?.pricingProcessStatus ??
      'Headless pricing action returned isSuccess: false'
    return { ok: false, error: msg, raw }
  }

  const ov = result.outputValues ?? {}
  const executionId = ov.executionId ?? ''
  const priceResult = normalizePricingResult(ov.pricingResult)
  const finals = getFinalHeadlessWaterfallPrices(raw)
  const taggedNet = getLineItemTaggedNumber(priceResult, 'NetUnitPrice')
  const taggedSub = getLineItemTaggedNumber(priceResult, 'Subtotal')

  const netUnitPrice =
    finals.netUnitPrice != null && Number.isFinite(finals.netUnitPrice)
      ? finals.netUnitPrice
      : taggedNet ?? 0

  const subtotal =
    finals.subtotal != null && Number.isFinite(finals.subtotal)
      ? finals.subtotal
      : taggedSub != null && Number.isFinite(taggedSub)
        ? taggedSub
        : netUnitPrice * quantity

  const currencyIsoCode =
    getLineItemTaggedString(priceResult, 'CurrencyIsoCode') ??
    getTaggedString(priceResult, 'CurrencyIsoCode') ??
    'USD'

  const record: PricingWaterfallRecord = {
    executionId,
    netUnitPrice,
    subtotal,
    currencyIsoCode,
    steps: [],
  }

  return { ok: true, record, raw }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTaggedNumber(
  result: Record<string, PricingResultTaggedValue[]>,
  key: string,
): number | undefined {
  const entries = result[key]
  if (!Array.isArray(entries) || entries.length === 0) return undefined
  const first = entries[0]
  if (first?.isSuccess && typeof first.value === 'number') return first.value
  return undefined
}

function getLineItemTaggedNumber(
  result: Record<string, PricingResultTaggedValue[]>,
  key: string,
): number | undefined {
  const entries = result[key]
  if (!Array.isArray(entries) || entries.length === 0) return undefined
  const lineItem = entries.find(
    (e) => e?.isSuccess && isLineItemPath(e.dataPath) && typeof e.value === 'number',
  )
  if (lineItem && typeof lineItem.value === 'number') return lineItem.value
  return getTaggedNumber(result, key)
}

function getTaggedString(
  result: Record<string, PricingResultTaggedValue[]>,
  key: string,
): string | undefined {
  const entries = result[key]
  if (!Array.isArray(entries) || entries.length === 0) return undefined
  const first = entries[0]
  if (first?.isSuccess && typeof first.value === 'string') return first.value
  return undefined
}

function getLineItemTaggedString(
  result: Record<string, PricingResultTaggedValue[]>,
  key: string,
): string | undefined {
  const entries = result[key]
  if (!Array.isArray(entries) || entries.length === 0) return undefined
  const lineItem = entries.find(
    (e) => e?.isSuccess && isLineItemPath(e.dataPath) && typeof e.value === 'string',
  )
  if (lineItem && typeof lineItem.value === 'string') return lineItem.value
  return getTaggedString(result, key)
}

/**
 * Salesforce REST invocable actions return errors as:
 * `[{ errors: [{ message, statusCode }], isSuccess: false, ... }]`
 * on HTTP 400 — not `[{ message }]` at the top level.
 */
function extractInvocableActionErrorBody(raw: unknown): string | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const row = raw[0] as {
    errors?: { message?: string }[]
    message?: string
  }
  const nested = row.errors?.[0]?.message
  if (typeof nested === 'string') return nested.replace(/\s+/g, ' ').trim()
  if (typeof row.message === 'string') return row.message.trim()
  return undefined
}

function extractErrorMsg(err: unknown): string | undefined {
  if (typeof err === 'string') return err
  if (Array.isArray(err)) {
    const msg = (err as { message?: string }[])[0]?.message
    if (typeof msg === 'string') return msg
  }
  return undefined
}
