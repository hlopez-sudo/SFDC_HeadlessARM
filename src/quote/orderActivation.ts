import type { LifecycleStep } from './useBuyNow'

const APP_USAGE_TYPE = 'RevenueLifecycleManagement'
const MAX_ACTIVATION_ATTEMPTS = 3
const ADDRESS_PARTS = ['Street', 'City', 'State', 'PostalCode', 'Country'] as const

type AddressPrefix = 'Billing' | 'Shipping'
type SfRecord = Record<string, string | null>

export type StepReporter = {
  addStep: (step: LifecycleStep) => number
  patchStep: (index: number, patch: Partial<LifecycleStep>) => void
  setLoadingStep: (label: string) => void
}

function addressFields(prefix: AddressPrefix): string[] {
  return ADDRESS_PARTS.map((part) => `${prefix}${part}`)
}

function hasAddress(record: SfRecord, prefix: AddressPrefix): boolean {
  return addressFields(prefix).some((field) => record[field])
}

function sfErrorMessage(text: string): string | null {
  try {
    const body = JSON.parse(text) as { message?: string }[]
    return Array.isArray(body) && body[0]?.message ? body[0].message : null
  } catch {
    return null
  }
}

async function queryFirst(base: string, soql: string): Promise<SfRecord | null> {
  const res = await fetch(`${base}/query?q=${encodeURIComponent(soql)}`)
  if (!res.ok) throw new Error(`Query failed: HTTP ${res.status}`)
  const body = (await res.json()) as { records?: SfRecord[] }
  return body.records?.[0] ?? null
}

/**
 * Activation requires billing and shipping addresses plus bill-to/ship-to
 * contacts, which the asset lifecycle APIs don't set. Fills only what's missing,
 * from the same sources Buy Now uses: the Account's addresses (shipping falls
 * back to billing) and its first Contact.
 */
async function completeOrderParties(
  base: string,
  orderId: string,
  { addStep, patchStep, setLoadingStep }: StepReporter,
): Promise<void> {
  const order = await queryFirst(
    base,
    `SELECT AccountId, BillToContactId, ShipToContactId, ${[...addressFields('Billing'), ...addressFields('Shipping')].join(', ')} ` +
      `FROM Order WHERE Id = '${orderId}'`,
  )
  if (!order) throw new Error('Order not found')
  const needsBilling = !hasAddress(order, 'Billing')
  const needsShipping = !hasAddress(order, 'Shipping')
  const needsContact = !order.BillToContactId || !order.ShipToContactId
  if (!needsBilling && !needsShipping && !needsContact) return

  setLoadingStep('Looking up account address and contact…')
  const account = await queryFirst(
    base,
    `SELECT ${[...addressFields('Billing'), ...addressFields('Shipping')].join(', ')} FROM Account WHERE Id = '${order.AccountId}'`,
  )
  const contact = needsContact
    ? await queryFirst(base, `SELECT Id FROM Contact WHERE AccountId = '${order.AccountId}' LIMIT 1`)
    : null

  const patch: Record<string, string | null> = {}
  if (account && needsBilling && hasAddress(account, 'Billing')) {
    for (const field of addressFields('Billing')) patch[field] = account[field]
  }
  if (account && needsShipping) {
    const source: AddressPrefix = hasAddress(account, 'Shipping') ? 'Shipping' : 'Billing'
    if (hasAddress(account, source)) {
      for (const part of ADDRESS_PARTS) patch[`Shipping${part}`] = account[`${source}${part}`]
    }
  }
  if (contact?.Id) {
    if (!order.BillToContactId) patch.BillToContactId = contact.Id
    if (!order.ShipToContactId) patch.ShipToContactId = contact.Id
  }
  // Nothing on the account to copy; activation reports what's still missing.
  if (Object.keys(patch).length === 0) return

  const url = `${base}/sobjects/Order/${orderId}`
  const idx = addStep({ name: 'Complete Order Billing Details', status: 'running', method: 'PATCH', url, requestBody: patch })
  setLoadingStep('Completing order billing details…')
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const text = await res.text()
    const message = sfErrorMessage(text) ?? `HTTP ${res.status}`
    patchStep(idx, { status: 'error', response: { status: res.status, body: text }, error: message })
    throw new Error(`Couldn't update the order's billing details: ${message}`)
  }
  patchStep(idx, { status: 'done', response: { status: res.status } })
}

/**
 * Activates a Draft order: ensures the RLM AppUsageAssignment exists, fills
 * missing billing details, then PATCHes Status to Activated with retries.
 * Orders created by the asset lifecycle APIs already carry the assignment, so
 * it is only created when missing.
 */
export async function activateOrder(
  apiVersion: string,
  orderId: string,
  reporter: StepReporter,
): Promise<void> {
  const { addStep, patchStep, setLoadingStep } = reporter
  const base = `/api/salesforce/services/data/v${apiVersion}`

  const auaSoql =
    `SELECT Id FROM AppUsageAssignment WHERE RecordId = '${orderId}' ` +
    `AND AppUsageType = '${APP_USAGE_TYPE}' LIMIT 1`
  const auaQueryUrl = `${base}/query?q=${encodeURIComponent(auaSoql)}`
  const checkIdx = addStep({ name: 'Check AppUsageAssignment', status: 'running', method: 'GET', url: auaQueryUrl })
  setLoadingStep('Checking AppUsageAssignment…')

  const checkRes = await fetch(auaQueryUrl)
  const checkData = (await checkRes.json()) as { records?: { Id: string }[] }
  if (!checkRes.ok) {
    patchStep(checkIdx, { status: 'error', response: checkData, error: `HTTP ${checkRes.status}` })
    throw new Error(`AppUsageAssignment lookup failed: HTTP ${checkRes.status}`)
  }
  const exists = (checkData.records ?? []).length > 0
  patchStep(checkIdx, { status: 'done', response: { exists } })

  if (!exists) {
    const auaUrl = `${base}/sobjects/AppUsageAssignment`
    const auaBody = { RecordId: orderId, AppUsageType: APP_USAGE_TYPE }
    const auaIdx = addStep({ name: 'Create AppUsageAssignment', status: 'running', method: 'POST', url: auaUrl, requestBody: auaBody })
    setLoadingStep('Creating AppUsageAssignment…')

    const auaRes = await fetch(auaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auaBody),
    })
    const auaData = (await auaRes.json()) as unknown
    if (!auaRes.ok) {
      patchStep(auaIdx, { status: 'error', response: auaData, error: `HTTP ${auaRes.status}` })
      throw new Error(`AppUsageAssignment creation failed: HTTP ${auaRes.status}`)
    }
    patchStep(auaIdx, { status: 'done', response: auaData })
  }

  await completeOrderParties(base, orderId, reporter)

  const actUrl = `${base}/sobjects/Order/${orderId}`
  const actBody = { Status: 'Activated' }
  const actIdx = addStep({ name: 'Activate Order', status: 'running', method: 'PATCH', url: actUrl, requestBody: actBody })
  setLoadingStep('Activating order…')

  let lastActResponse: unknown = null
  let lastError: string | null = null
  for (let attempt = 1; attempt <= MAX_ACTIVATION_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500))
    }
    const actRes = await fetch(actUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actBody),
    })
    if (actRes.ok) {
      patchStep(actIdx, { status: 'done', response: { status: actRes.status } })
      return
    }
    const errText = await actRes.text()
    lastActResponse = { status: actRes.status, body: errText }
    lastError = sfErrorMessage(errText)
    if (errText.includes('ALREADY_ACTIVATED') || errText.includes('Status: Activated')) {
      patchStep(actIdx, { status: 'done', response: lastActResponse })
      return
    }
  }

  const message = lastError
    ? `Order could not be activated: ${lastError}`
    : `Order could not be activated after ${MAX_ACTIVATION_ATTEMPTS} attempts`
  patchStep(actIdx, { status: 'error', response: lastActResponse, error: message })
  throw new Error(message)
}
