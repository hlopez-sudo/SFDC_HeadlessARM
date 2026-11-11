// ---------------------------------------------------------------------------
// assetActions — Revenue Cloud asset lifecycle actions (amend, renew, cancel,
// upgrade, downgrade, swap). ASSET_ACTIONS is the single definition each action
// is driven from: the dashboard buttons, eligibility, request bodies, response
// parsing and the drawer form all read it.
// ---------------------------------------------------------------------------

import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  PencilLine,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { AssetRecord } from '../hooks/useAccountAssets'
import { extractPstErrorMessage } from './placeSalesTransactionError'

export const OUTPUT_RECORD_TYPES = ['Quote', 'Order'] as const
export type OutputRecordType = (typeof OUTPUT_RECORD_TYPES)[number]

const TERM = 'TermDefined'
const EVERGREEN = 'Evergreen'

const SELLING_MODEL_LABELS: Record<string, string> = {
  TermDefined: 'Term',
  Evergreen: 'Evergreen',
  OneTime: 'One-Time',
}

export type AssetActionKey = 'amend' | 'renew' | 'cancel' | 'upgrade' | 'downgrade' | 'swap'

export type AssetActionDef = {
  key: AssetActionKey
  label: string
  icon: LucideIcon
  variant: 'primary' | 'secondary' | 'danger'
  /** `lifecycle` takes assetIds; `swap` takes one swap group per asset. */
  family: 'lifecycle' | 'swap'
  /** Path under /services/data/vXX.X/. */
  path: string
  minApiVersion: number
  /** Response keys that can carry the created Quote/Order ID (first match wins). */
  resultIdKeys: string[]
  /** Request field for the effective date; the form defaults it to "now". */
  dateField?: string
  dateLabel?: string
  /**
   * Request field for a signed quantity delta. A request carries one value, so
   * assets with different changes are sent as separate requests.
   */
  quantityChangeField?: string
  /** Request field that adds assets to an existing Quote/Order, keeping those requests on one record. */
  outputRecordIdField?: string
  /** Optional custom term; `start` becomes required when an asset has expired. */
  termFields?: { start: string; end: string }
  /** inGroup graphId for swap-family requests. */
  graphId?: string
  /** Which side of the asset's current unit price target products may sit on. */
  targetPriceFilter?: 'above' | 'below' | 'any'
  sellingModelTypes: string[]
  allowUsageBased: boolean
  /** Output types allowed when the selection includes a usage-based asset. */
  usageOutputTypes?: OutputRecordType[]
  allowRamped: boolean
  allowDerivedPrice: boolean
  allowExpired: boolean
  requiresRenewalTerm: boolean
}

const LIFECYCLE_BASE = 'connect/revenue-management/assets/actions'
const SWAP_BASE = 'revenue/transaction-management/assets/actions'

export const ASSET_ACTIONS: AssetActionDef[] = [
  {
    key: 'amend',
    label: 'Amend',
    icon: PencilLine,
    variant: 'secondary',
    family: 'lifecycle',
    path: `${LIFECYCLE_BASE}/amend`,
    minApiVersion: 62,
    // The documented response example spells the key without the second "t".
    resultIdKeys: ['amendmentRecordId', 'amendmenRecordId'],
    dateField: 'amendmentStartDate',
    dateLabel: 'Amendment start date',
    quantityChangeField: 'quantityChange',
    outputRecordIdField: 'outputRecordId',
    sellingModelTypes: [TERM, EVERGREEN],
    allowUsageBased: true,
    // Direct-to-Order amendments skip the usage rate card records.
    usageOutputTypes: ['Quote'],
    allowRamped: true,
    allowDerivedPrice: true,
    allowExpired: false,
    requiresRenewalTerm: false,
  },
  {
    key: 'renew',
    label: 'Renew',
    icon: RefreshCw,
    variant: 'secondary',
    family: 'lifecycle',
    path: `${LIFECYCLE_BASE}/renew`,
    minApiVersion: 62,
    resultIdKeys: ['renewalRecordId'],
    termFields: { start: 'renewalStartDate', end: 'renewalEndDate' },
    sellingModelTypes: [TERM],
    allowUsageBased: true,
    allowRamped: true,
    allowDerivedPrice: true,
    allowExpired: true,
    requiresRenewalTerm: true,
  },
  {
    key: 'cancel',
    label: 'Cancel',
    icon: XCircle,
    variant: 'danger',
    family: 'lifecycle',
    path: `${LIFECYCLE_BASE}/cancel`,
    minApiVersion: 62,
    resultIdKeys: ['cancellationRecordId'],
    dateField: 'cancellationDate',
    dateLabel: 'Cancellation date',
    sellingModelTypes: [TERM, EVERGREEN],
    allowUsageBased: true,
    allowRamped: true,
    allowDerivedPrice: true,
    allowExpired: false,
    requiresRenewalTerm: false,
  },
  {
    key: 'upgrade',
    label: 'Upgrade',
    icon: ArrowUpRight,
    variant: 'primary',
    family: 'swap',
    path: `${SWAP_BASE}/upgrade`,
    minApiVersion: 66,
    resultIdKeys: ['salesTransactionId'],
    dateField: 'swapStartDate',
    dateLabel: 'Upgrade date',
    graphId: 'upgradeRequest',
    targetPriceFilter: 'above',
    sellingModelTypes: [TERM, EVERGREEN],
    allowUsageBased: false,
    allowRamped: false,
    allowDerivedPrice: false,
    allowExpired: false,
    requiresRenewalTerm: false,
  },
  {
    key: 'downgrade',
    label: 'Downgrade',
    icon: ArrowDownRight,
    variant: 'secondary',
    family: 'swap',
    path: `${SWAP_BASE}/downgrade`,
    minApiVersion: 66,
    resultIdKeys: ['salesTransactionId'],
    dateField: 'swapStartDate',
    dateLabel: 'Downgrade date',
    graphId: 'downgradeRequest',
    targetPriceFilter: 'below',
    sellingModelTypes: [TERM, EVERGREEN],
    allowUsageBased: false,
    allowRamped: false,
    allowDerivedPrice: false,
    allowExpired: false,
    requiresRenewalTerm: false,
  },
  {
    key: 'swap',
    label: 'Swap',
    icon: ArrowLeftRight,
    variant: 'secondary',
    family: 'swap',
    path: `${SWAP_BASE}/swap`,
    minApiVersion: 66,
    resultIdKeys: ['salesTransactionId'],
    dateField: 'swapStartDate',
    dateLabel: 'Swap date',
    graphId: 'swapRequest',
    targetPriceFilter: 'any',
    sellingModelTypes: [TERM, EVERGREEN],
    allowUsageBased: false,
    allowRamped: false,
    allowDerivedPrice: false,
    allowExpired: false,
    requiresRenewalTerm: false,
  },
]

export function sellingModelLabel(type: string | null): string {
  if (!type) return 'Unknown'
  return SELLING_MODEL_LABELS[type] ?? type
}

// ── Dates ───────────────────────────────────────────────────────────────────
// Asset lifecycle boundaries are stored as instants at local midnight of the
// time zone the asset was sold in, and Asset doesn't expose that zone. The UTC
// time of day of LifecycleStartDate therefore gives the day boundary to apply
// to dates picked in the form.

const DAY_MS = 86_400_000

export function boundaryOffsetMs(asset: AssetRecord | undefined): number {
  const start = asset?.startDate ? new Date(asset.startDate).getTime() : NaN
  if (Number.isNaN(start)) return 0
  const timeOfDay = ((start % DAY_MS) + DAY_MS) % DAY_MS
  return timeOfDay > DAY_MS / 2 ? timeOfDay - DAY_MS : timeOfDay
}

export function selectionBoundaryOffsetMs(assets: AssetRecord[]): number {
  return boundaryOffsetMs(assets[0])
}

/** "UTC" or "UTC−08:00" for a boundary offset. */
export function formatBoundaryOffset(offsetMs: number): string {
  if (offsetMs === 0) return 'UTC'
  const minutes = Math.abs(offsetMs) / 60_000
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `UTC${offsetMs > 0 ? '−' : '+'}${hh}:${mm}`
}

function toIsoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** YYYY-MM-DD of an instant on the asset's calendar. */
function dateAtBoundary(instant: Date, offsetMs: number): string {
  return new Date(instant.getTime() - offsetMs).toISOString().slice(0, 10)
}

/** Start (or last second) of a YYYY-MM-DD day on the asset's calendar, as an ISO instant. */
function boundaryIso(date: string, offsetMs: number, endOfDay = false): string {
  const [y, m, d] = date.split('-').map(Number)
  const start = Date.UTC(y, m - 1, d) + offsetMs
  return toIsoSeconds(new Date(endOfDay ? start + DAY_MS - 1000 : start))
}

// ── Eligibility ─────────────────────────────────────────────────────────────

export type EligibilityContext = {
  allAssets: AssetRecord[]
  apiVersion: string
  isMultiCurrency: boolean
  now?: Date
}

export type SelectionEligibility = { ok: boolean; reasons: string[] }

function isExpired(asset: AssetRecord, now: Date): boolean {
  return asset.endDate !== null && new Date(asset.endDate).getTime() < now.getTime()
}

function bundleChildren(asset: AssetRecord, allAssets: AssetRecord[]): AssetRecord[] {
  return allAssets.filter((a) => a.id !== asset.id && (a.rootAssetId === asset.id || a.parentId === asset.id))
}

function assetBlockers(action: AssetActionDef, asset: AssetRecord, ctx: EligibilityContext, now: Date): string[] {
  const reasons: string[] = []
  if (asset.parentId) reasons.push('part of a bundle (select its parent asset)')
  if (!asset.hasLifecycleManagement) reasons.push('lifecycle management is off')
  if ((asset.quantity ?? 0) <= 0) reasons.push('no active quantity')
  if (!asset.sellingModelType) reasons.push('selling model unknown')
  else if (!action.sellingModelTypes.includes(asset.sellingModelType)) {
    reasons.push(`not available for ${sellingModelLabel(asset.sellingModelType)} assets`)
  }
  if (!action.allowExpired && isExpired(asset, now)) reasons.push('expired')
  if (!action.allowUsageBased && asset.usageModelType) reasons.push('usage-based')
  if (!action.allowRamped && asset.isRamped) reasons.push('ramped')
  if (!action.allowDerivedPrice && asset.isDerivedPrice) reasons.push('derived price')
  if (action.requiresRenewalTerm && (asset.renewalTerm == null || !asset.renewalTermUnit)) {
    reasons.push('missing renewal term')
  }
  if (action.family === 'swap') {
    if (!asset.pricebookId) reasons.push('price book unknown')
    if (action.targetPriceFilter !== 'any' && asset.currentUnitPrice == null) reasons.push('current price unknown')
  }
  for (const child of bundleChildren(asset, ctx.allAssets)) {
    if (!action.allowUsageBased && child.usageModelType) reasons.push(`bundle includes usage-based ${child.name}`)
    if (!action.allowRamped && child.isRamped) reasons.push(`bundle includes ramped ${child.name}`)
  }
  return reasons
}

function distinctCount(values: (string | null)[]): number {
  return new Set(values).size
}

export function selectionEligibility(
  action: AssetActionDef,
  selected: AssetRecord[],
  ctx: EligibilityContext,
): SelectionEligibility {
  const now = ctx.now ?? new Date()
  const reasons: string[] = []

  if (Number(ctx.apiVersion) < action.minApiVersion) {
    reasons.push(`Requires API v${action.minApiVersion.toFixed(1)} or later (org is v${ctx.apiVersion})`)
  }

  for (const asset of selected) {
    const blockers = assetBlockers(action, asset, ctx, now)
    if (blockers.length) reasons.push(`${asset.name}: ${blockers.join(', ')}`)
  }

  // One request carries one effective date, price book and currency for every asset.
  if (selected.length > 1) {
    if (distinctCount(selected.map((a) => a.pricebookId)) > 1) reasons.push('Selected assets use different price books')
    if (new Set(selected.map(boundaryOffsetMs)).size > 1) {
      reasons.push('Selected assets are in different time zones')
    }
    if (ctx.isMultiCurrency && distinctCount(selected.map((a) => a.currencyIsoCode)) > 1) {
      reasons.push('Selected assets use different currencies')
    }
  }

  return { ok: selected.length > 0 && reasons.length === 0, reasons }
}

export function allowedOutputTypes(action: AssetActionDef, assets: AssetRecord[]): OutputRecordType[] {
  if (action.usageOutputTypes && assets.some((a) => a.usageModelType)) return action.usageOutputTypes
  return [...OUTPUT_RECORD_TYPES]
}

// ── Form ────────────────────────────────────────────────────────────────────

export type SwapTarget = {
  pricebookEntryId: string
  productId: string
  productName: string
  sellingModelName: string | null
  unitPrice: number
}

export type SwapLine = { target: SwapTarget | null; outQuantity: number; inQuantity: number }

export type AssetActionForm = {
  outputRecordType: OutputRecordType
  /** YYYY-MM-DD on the selection's calendar; empty means "now". */
  effectiveDate: string
  quantityChanges: Record<string, number>
  termStart: string
  termEnd: string
  swapLines: Record<string, SwapLine>
}

export function initialAssetActionForm(action: AssetActionDef, assets: AssetRecord[]): AssetActionForm {
  return {
    outputRecordType: allowedOutputTypes(action, assets)[0],
    effectiveDate: '',
    quantityChanges: Object.fromEntries(assets.map((a) => [a.id, 1])),
    termStart: '',
    termEnd: '',
    swapLines: Object.fromEntries(
      assets.map((a) => [a.id, { target: null, outQuantity: a.quantity ?? 1, inQuantity: a.quantity ?? 1 }]),
    ),
  }
}

export function validateAssetActionForm(
  action: AssetActionDef,
  assets: AssetRecord[],
  form: AssetActionForm,
  now = new Date(),
): string | null {
  if (!allowedOutputTypes(action, assets).includes(form.outputRecordType)) {
    return `${form.outputRecordType} output isn't supported for usage-based assets. Choose ${allowedOutputTypes(action, assets).join(' or ')}.`
  }

  if (action.quantityChangeField) {
    for (const asset of assets) {
      const change = form.quantityChanges[asset.id]
      if (!Number.isFinite(change) || change === 0) return `Enter a quantity change other than zero for ${asset.name}.`
      if ((asset.quantity ?? 0) + change < 0) return `A change of ${change} would take ${asset.name} below zero.`
    }
  }

  if (action.termFields) {
    if (!form.termStart && assets.some((a) => isExpired(a, now))) {
      return 'A start date is required to renew expired assets.'
    }
    if (form.termStart && form.termEnd && form.termEnd <= form.termStart) {
      return 'The end date must be after the start date.'
    }
  }

  if (action.family === 'swap') {
    for (const asset of assets) {
      const line = form.swapLines[asset.id]
      if (!line?.target) return `Choose a product for ${asset.name}.`
      if (!(line.outQuantity > 0) || line.outQuantity > (asset.quantity ?? 0)) {
        return `Quantity out for ${asset.name} must be between 1 and ${asset.quantity ?? 0}.`
      }
      if (!(line.inQuantity > 0)) return `Quantity in for ${asset.name} must be greater than zero.`
    }
  }

  return null
}

// ── Requests ────────────────────────────────────────────────────────────────

const LINE_RECORDS: Record<OutputRecordType, { type: string; startField: string }> = {
  Quote: { type: 'QuoteLineItem', startField: 'StartDate' },
  Order: { type: 'OrderItem', startField: 'ServiceDate' },
}

const PLACEHOLDER = '(choose a product)'
const CHAINED_RECORD_PLACEHOLDER = '(ID returned by the first request)'

function groupByQuantityChange(assets: AssetRecord[], form: AssetActionForm): AssetRecord[][] {
  const groups = new Map<number, AssetRecord[]>()
  for (const asset of assets) {
    const change = form.quantityChanges[asset.id]
    groups.set(change, [...(groups.get(change) ?? []), asset])
  }
  return [...groups.values()]
}

/**
 * Bodies are sent in order. When there is more than one, the first creates the
 * Quote/Order and the rest carry outputRecordIdField; the caller replaces its
 * placeholder with the ID the first request returns.
 */
export function buildAssetActionRequests(
  action: AssetActionDef,
  assets: AssetRecord[],
  form: AssetActionForm,
  apiVersion: string,
  now = new Date(),
): { url: string; bodies: Record<string, unknown>[] } {
  const url = `/api/salesforce/services/data/v${apiVersion}/${action.path}`
  const offset = selectionBoundaryOffsetMs(assets)
  const effective = form.effectiveDate ? boundaryIso(form.effectiveDate, offset) : toIsoSeconds(now)
  const shared: Record<string, unknown> = { outputRecordType: form.outputRecordType }
  if (action.dateField) shared[action.dateField] = effective
  if (action.termFields) {
    if (form.termStart) shared[action.termFields.start] = boundaryIso(form.termStart, offset)
    if (form.termEnd) shared[action.termFields.end] = boundaryIso(form.termEnd, offset, true)
  }

  if (action.family === 'lifecycle') {
    const { quantityChangeField, outputRecordIdField } = action
    const groups = quantityChangeField ? groupByQuantityChange(assets, form) : [assets]
    const bodies = groups.map((group, i) => ({
      assetIds: group.map((a) => a.id),
      ...shared,
      ...(quantityChangeField ? { [quantityChangeField]: form.quantityChanges[group[0].id] } : {}),
      ...(i > 0 && outputRecordIdField ? { [outputRecordIdField]: CHAINED_RECORD_PLACEHOLDER } : {}),
    }))
    return { url, bodies }
  }

  const body: Record<string, unknown> = { ...shared }
  if (action.family === 'swap') {
    const { type, startField } = LINE_RECORDS[form.outputRecordType]
    const lineStart = form.effectiveDate || dateAtBoundary(now, offset)
    body.swapGroups = {
      groups: assets.map((asset, i) => {
        const line = form.swapLines[asset.id]
        const target = line?.target ?? null
        return {
          referenceId: `${action.key.toUpperCase()}-${i + 1}`,
          outGroup: { swapAssets: [{ assetId: asset.id, quantity: line?.outQuantity ?? asset.quantity }] },
          inGroup: {
            graphId: action.graphId,
            records: [
              {
                referenceId: `refLine${i}`,
                record: {
                  attributes: { type, method: 'POST' },
                  Product2Id: target?.productId ?? PLACEHOLDER,
                  PricebookEntryId: target?.pricebookEntryId ?? PLACEHOLDER,
                  UnitPrice: target?.unitPrice ?? PLACEHOLDER,
                  Quantity: line?.inQuantity ?? asset.quantity,
                  [startField]: lineStart,
                  // Term lines need an end date for pricing; co-term with the outgoing asset.
                  ...(asset.endDate ? { EndDate: dateAtBoundary(new Date(asset.endDate), offset) } : {}),
                },
              },
            ],
          },
        }
      }),
    }
  }

  return { url, bodies: [body] }
}

// ── Target product lookup (swap family) ─────────────────────────────────────

export const TARGET_LOOKUP = {
  sObject: 'PricebookEntry',
  queryFields: ['Id', 'Product2Id', 'Product2.Name', 'ProductSellingModel.Name', 'UnitPrice'],
  searchFields: ['Product2.Name'],
  valueField: 'Id',
  displayField: 'Product2.Name',
  subLabelField: 'ProductSellingModel.Name',
  orderBy: 'UnitPrice ASC',
}

export function targetLookupWhere(action: AssetActionDef, asset: AssetRecord, isMultiCurrency: boolean): string {
  const conditions = [
    `Pricebook2Id = '${asset.pricebookId}'`,
    'IsActive = true',
    'IsDerived = false',
    'Product2.IsAssetizable = true',
    'Product2.UsageModelType = null',
  ]
  if (asset.productId) conditions.push(`Product2Id != '${asset.productId}'`)
  if (asset.sellingModelType) conditions.push(`ProductSellingModel.SellingModelType = '${asset.sellingModelType}'`)
  if (asset.pricingTermUnit) conditions.push(`ProductSellingModel.PricingTermUnit = '${asset.pricingTermUnit}'`)
  if (isMultiCurrency && asset.currencyIsoCode) conditions.push(`CurrencyIsoCode = '${asset.currencyIsoCode}'`)
  if (asset.currentUnitPrice != null) {
    if (action.targetPriceFilter === 'above') conditions.push(`UnitPrice > ${asset.currentUnitPrice}`)
    if (action.targetPriceFilter === 'below') conditions.push(`UnitPrice < ${asset.currentUnitPrice}`)
  }
  return conditions.join(' AND ')
}

export function swapTargetFromRecord(record: Record<string, unknown>): SwapTarget {
  const product = record.Product2 as { Name?: string } | null
  const sellingModel = record.ProductSellingModel as { Name?: string } | null
  return {
    pricebookEntryId: String(record.Id),
    productId: String(record.Product2Id),
    productName: product?.Name ?? String(record.Product2Id),
    sellingModelName: sellingModel?.Name ?? null,
    unitPrice: Number(record.UnitPrice),
  }
}

// ── Responses ───────────────────────────────────────────────────────────────

type ArcError = { errorCode?: string; message?: string; errorMessage?: string }

export function parseAssetActionResponse(
  action: AssetActionDef,
  httpOk: boolean,
  status: number,
  data: unknown,
): { recordId: string | null; error: string | null } {
  const body = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null
  const apiErrors = Array.isArray(body?.errors)
    ? (body.errors as ArcError[])
        .map((e) => e.message ?? e.errorMessage ?? e.errorCode)
        .filter((m): m is string => Boolean(m))
    : []

  if (!httpOk) {
    return { recordId: null, error: apiErrors.join(' | ') || extractPstErrorMessage(data, status) }
  }
  if (body?.success !== true || apiErrors.length) {
    return { recordId: null, error: apiErrors.join(' | ') || 'Salesforce reported the request as unsuccessful.' }
  }
  const recordId = action.resultIdKeys
    .map((key) => body[key])
    .find((value): value is string => typeof value === 'string' && value.length > 0)
  if (!recordId) return { recordId: null, error: 'Salesforce did not return a record ID.' }
  return { recordId, error: null }
}

// ── Read-back of the created Quote/Order lines ──────────────────────────────

export type ResultLine = {
  id: string
  productName: string
  type: string | null
  subType: string | null
  sourceAssetId: string | null
  startQuantity: number | null
  quantity: number | null
  endQuantity: number | null
  startDate: string | null
  endDate: string | null
  totalPrice: number | null
}

const READ_BACK: Record<
  OutputRecordType,
  { sObject: string; parentField: string; actionRel: string; startDateField: string; quantityFields: string[] }
> = {
  Quote: {
    sObject: 'QuoteLineItem',
    parentField: 'QuoteId',
    actionRel: 'QuoteAction',
    startDateField: 'StartDate',
    quantityFields: ['StartQuantity', 'Quantity', 'EndQuantity'],
  },
  Order: {
    sObject: 'OrderItem',
    parentField: 'OrderId',
    actionRel: 'OrderAction',
    startDateField: 'ServiceDate',
    quantityFields: ['Quantity'],
  },
}

export function readBackUrl(outputRecordType: OutputRecordType, recordId: string, apiVersion: string): string {
  const cfg = READ_BACK[outputRecordType]
  const fields = [
    'Id',
    'Product2.Name',
    `${cfg.actionRel}.Type`,
    `${cfg.actionRel}.Subtype`,
    `${cfg.actionRel}.SourceAssetId`,
    ...cfg.quantityFields,
    cfg.startDateField,
    'EndDate',
    'TotalPrice',
  ]
  const soql = `SELECT ${fields.join(', ')} FROM ${cfg.sObject} WHERE ${cfg.parentField} = '${recordId}' ORDER BY CreatedDate`
  return `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(soql)}`
}

export function parseReadBack(outputRecordType: OutputRecordType, records: Record<string, unknown>[]): ResultLine[] {
  const cfg = READ_BACK[outputRecordType]
  const num = (v: unknown) => (typeof v === 'number' ? v : null)
  const str = (v: unknown) => (typeof v === 'string' ? v : null)
  return records.map((r) => {
    const action = (r[cfg.actionRel] ?? null) as Record<string, unknown> | null
    const product = (r.Product2 ?? null) as { Name?: string } | null
    return {
      id: String(r.Id),
      productName: product?.Name ?? '—',
      type: str(action?.Type),
      subType: str(action?.Subtype),
      sourceAssetId: str(action?.SourceAssetId),
      startQuantity: num(r.StartQuantity),
      quantity: num(r.Quantity),
      endQuantity: num(r.EndQuantity),
      startDate: str(r[cfg.startDateField]),
      endDate: str(r.EndDate),
      totalPrice: num(r.TotalPrice),
    }
  })
}
