import {
  isLineItemPath,
  normalizePricingResult,
  type PricingResultTaggedValue,
} from './pricingResultNormalize'

export type HeadlessWaterfallStepRow = {
  sequence: number
  name: string
  elementType: string
  /** First task name from tasksInfo, if any */
  taskHint: string | null
  /** NetUnitPrice: outputParameters first, then inputParameters */
  stepNetUnitPrice: number | null
  /** Subtotal: outputParameters first, then inputParameters */
  stepSubtotal: number | null
}

const PRICE_WATERFALL_KEYS = ['PriceWaterFall', 'PriceWaterfall'] as const

type InvocableRow = {
  outputValues?: { pricingResult?: unknown }
}

function getFirstInvocableRow(raw: unknown): InvocableRow | undefined {
  if (Array.isArray(raw) && raw.length > 0) return raw[0] as InvocableRow
  if (raw != null && typeof raw === 'object') return raw as InvocableRow
  return undefined
}

function pickPriceWaterFallEntry(
  entries: PricingResultTaggedValue[] | undefined,
): PricingResultTaggedValue | undefined {
  if (!Array.isArray(entries) || entries.length === 0) return undefined
  const lineItem = entries.find(
    (e) => e?.isSuccess && isLineItemPath(e.dataPath) && e.value != null,
  )
  if (lineItem) return lineItem
  return entries.find((e) => e?.isSuccess && e.value != null)
}

function extractWaterfallArray(value: unknown): unknown[] {
  if (value == null) return []
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as { waterfall?: unknown[] }
      return Array.isArray(parsed?.waterfall) ? parsed.waterfall : []
    } catch {
      return []
    }
  }
  if (typeof value === 'object' && value !== null && 'waterfall' in value) {
    const w = (value as { waterfall?: unknown[] }).waterfall
    return Array.isArray(w) ? w : []
  }
  return []
}

/**
 * Returns the raw waterfall step objects from a headless API `pricing.raw` payload.
 */
export function extractHeadlessWaterfallArray(raw: unknown): unknown[] {
  const inv = getFirstInvocableRow(raw)
  const tags = normalizePricingResult(inv?.outputValues?.pricingResult)

  let entries: PricingResultTaggedValue[] | undefined
  for (const key of PRICE_WATERFALL_KEYS) {
    const e = tags[key]
    if (Array.isArray(e) && e.length > 0) {
      entries = e
      break
    }
  }

  const picked = pickPriceWaterFallEntry(entries)
  if (!picked?.value) return []

  return extractWaterfallArray(picked.value)
}

/** Single key: outputParameters first, then inputParameters */
function extractParamNumber(
  outputParameters: unknown,
  inputParameters: unknown,
  key: string,
): number | null {
  for (const params of [outputParameters, inputParameters]) {
    if (params == null || typeof params !== 'object' || Array.isArray(params)) continue
    const v = (params as Record<string, unknown>)[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

type WaterfallStepShape = {
  sequence?: number
  pricingElement?: { name?: string; elementType?: string }
  tasksInfo?: { taskName?: string }[]
  inputParameters?: unknown
  outputParameters?: unknown
}

function stepNetUnitPriceFromItem(item: WaterfallStepShape): number | null {
  return extractParamNumber(item.outputParameters, item.inputParameters, 'NetUnitPrice')
}

function stepSubtotalFromItem(item: WaterfallStepShape): number | null {
  return extractParamNumber(item.outputParameters, item.inputParameters, 'Subtotal')
}

export type FinalHeadlessWaterfallPrices = {
  netUnitPrice: number | null
  subtotal: number | null
}

/**
 * Final NetUnitPrice and Subtotal from the headless waterfall: prefer the last step(s)
 * by sequence; walk backward until each value is found.
 */
export function getFinalHeadlessWaterfallPrices(raw: unknown): FinalHeadlessWaterfallPrices {
  const waterfall = extractHeadlessWaterfallArray(raw)
  if (waterfall.length === 0) return { netUnitPrice: null, subtotal: null }

  const items = waterfall
    .map((item, i) => {
      if (item == null || typeof item !== 'object') return null
      const o = item as WaterfallStepShape
      const sequence = typeof o.sequence === 'number' ? o.sequence : i + 1
      return { sequence, o }
    })
    .filter((x): x is { sequence: number; o: WaterfallStepShape } => x != null)
    .sort((a, b) => a.sequence - b.sequence)

  let netUnitPrice: number | null = null
  let subtotal: number | null = null

  for (let i = items.length - 1; i >= 0; i--) {
    if (netUnitPrice != null && subtotal != null) break
    const { o } = items[i]
    if (netUnitPrice == null) {
      const n = stepNetUnitPriceFromItem(o)
      if (n != null) netUnitPrice = n
    }
    if (subtotal == null) {
      const s = stepSubtotalFromItem(o)
      if (s != null) subtotal = s
    }
  }

  return { netUnitPrice, subtotal }
}

/**
 * Parses `pricing.raw` from a successful `runSalesforceHeadlessPricing` call into
 * ordered waterfall step rows (sequence, pricing element name/type, optional task hint).
 */
export function parseHeadlessWaterfallSteps(raw: unknown): HeadlessWaterfallStepRow[] {
  const waterfall = extractHeadlessWaterfallArray(raw)
  const rows: HeadlessWaterfallStepRow[] = []

  for (let i = 0; i < waterfall.length; i++) {
    const item = waterfall[i]
    if (item == null || typeof item !== 'object') continue
    const o = item as WaterfallStepShape
    const sequence = typeof o.sequence === 'number' ? o.sequence : i + 1
    const name = o.pricingElement?.name?.trim() || 'Step'
    const elementType = o.pricingElement?.elementType?.trim() || '—'
    const firstTask = o.tasksInfo?.[0]?.taskName?.trim()
    rows.push({
      sequence,
      name,
      elementType,
      taskHint: firstTask || null,
      stepNetUnitPrice: stepNetUnitPriceFromItem(o),
      stepSubtotal: stepSubtotalFromItem(o),
    })
  }

  rows.sort((a, b) => a.sequence - b.sequence)
  return rows
}
