import { useCallback, useRef, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import { useHeadlessPricingConfig } from '../salesforce/HeadlessPricingConfigContext'

const ACTIVE_ACCOUNT_KEY = 'fc-active-account'

type ActiveAccount = { accountId: string; accountName: string }

function loadActiveAccount(): ActiveAccount | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ACCOUNT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      'accountId' in parsed &&
      typeof (parsed as Record<string, unknown>).accountId === 'string'
    ) {
      return parsed as ActiveAccount
    }
    return null
  } catch {
    return null
  }
}

export type LifecycleStep = {
  name: string
  status: 'pending' | 'running' | 'done' | 'error'
  method?: string
  url?: string
  requestBody?: unknown
  response?: unknown
  error?: string
}

export type BuyNowState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  loadingStep: string | null
  orderId: string | null
  error: string | null
  apiResponse: unknown | null
  requestUrl: string | null
  requestBody: unknown | null
  lifecycleSteps: LifecycleStep[]
}

const IDLE: BuyNowState = {
  status: 'idle',
  loadingStep: null,
  orderId: null,
  error: null,
  apiResponse: null,
  requestUrl: null,
  requestBody: null,
  lifecycleSteps: [],
}

type AccountAddress = {
  BillingStreet: string | null
  BillingCity: string | null
  BillingState: string | null
  BillingPostalCode: string | null
  BillingCountry: string | null
  ShippingStreet: string | null
  ShippingCity: string | null
  ShippingState: string | null
  ShippingPostalCode: string | null
  ShippingCountry: string | null
}

export function useBuyNow() {
  const { orgInfo } = useSalesforceConfig()
  const { config } = useHeadlessPricingConfig()
  const [state, setState] = useState<BuyNowState>(IDLE)

  // Ref to hold the mutable steps array during a run so we can update individual steps
  const stepsRef = useRef<LifecycleStep[]>([])

  const submit = useCallback(
    async (productId: string, sellingModel: string, quantity: number = 1, sellingModelId?: string) => {
      const pricebookId = config.pricebookId.trim()
      if (!pricebookId) {
        setState({
          ...IDLE,
          status: 'error',
          error: 'Pricebook ID is not configured. Set it in Admin → Salesforce → Headless Pricing Config.',
        })
        return
      }

      const account = loadActiveAccount()
      if (!account?.accountId) {
        setState({
          ...IDLE,
          status: 'error',
          error: 'No active account selected. Please select an account first.',
        })
        return
      }

      stepsRef.current = []
      setState({ ...IDLE, status: 'loading', loadingStep: 'Preparing order…' })

      const apiVersion = orgInfo.apiVersion || '67.0'
      const accountId = account.accountId

      const smLower = sellingModel.toLowerCase()
      const billingPeriod: 'monthly' | 'annual' = smLower.includes('annual') ? 'annual' : 'monthly'

      // Buy Now: 1-year term (createRLMOrder parity) → end = start + 1 year − 1 day
      const today = new Date()
      const startDate = today.toISOString().split('T')[0]
      const endDateObj = new Date(today)
      endDateObj.setFullYear(endDateObj.getFullYear() + 1)
      endDateObj.setDate(endDateObj.getDate() - 1)
      const endDate = endDateObj.toISOString().split('T')[0]

      // Helper: update a specific lifecycle step by index and sync to state
      function patchStep(index: number, patch: Partial<LifecycleStep>) {
        stepsRef.current = stepsRef.current.map((s, i) => (i === index ? { ...s, ...patch } : s))
        setState((prev) => ({
          ...prev,
          lifecycleSteps: [...stepsRef.current],
        }))
      }

      // Helper: add a new step and return its index
      function addStep(step: LifecycleStep): number {
        stepsRef.current = [...stepsRef.current, step]
        setState((prev) => ({
          ...prev,
          lifecycleSteps: [...stepsRef.current],
        }))
        return stepsRef.current.length - 1
      }

      // Helper: set loadingStep label without touching other state
      function setLoadingStep(label: string) {
        setState((prev) => ({ ...prev, loadingStep: label }))
      }

      try {
        // ── Pre-flight SOQLs ─────────────────────────────────────────────────

        setLoadingStep('Looking up account address…')
        const accountSoql =
          `SELECT BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry, ` +
          `ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry ` +
          `FROM Account WHERE Id = '${accountId}'`
        const accountRes = await fetch(
          `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(accountSoql)}`,
        )
        if (!accountRes.ok) throw new Error(`Account lookup failed: HTTP ${accountRes.status}`)
        const accountData = (await accountRes.json()) as { records: AccountAddress[] }
        const addr = accountData.records[0] ?? {}

        setLoadingStep('Looking up contact…')
        const contactSoql = `SELECT Id FROM Contact WHERE AccountId = '${accountId}' LIMIT 1`
        const contactRes = await fetch(
          `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(contactSoql)}`,
        )
        const contactData = contactRes.ok
          ? ((await contactRes.json()) as { records: { Id: string }[] })
          : { records: [] }
        const contactId = contactData.records[0]?.Id ?? null

        setLoadingStep('Looking up pricebook entry…')
        const pbSoql =
          `SELECT Id, UnitPrice, ProductSellingModelId FROM PricebookEntry ` +
          `WHERE Product2Id = '${productId}' AND Pricebook2Id = '${pricebookId}' AND IsActive = true ` +
          `ORDER BY UnitPrice ASC`
        const pbRes = await fetch(
          `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(pbSoql)}`,
        )
        if (!pbRes.ok) throw new Error(`PricebookEntry lookup failed: HTTP ${pbRes.status}`)
        const pbData = (await pbRes.json()) as {
          records: { Id: string; UnitPrice: number; ProductSellingModelId?: string | null }[]
        }
        if (!pbData.records.length) {
          throw new Error('No active PricebookEntry found for this product. Check the Pricebook ID in Admin → Salesforce.')
        }
        // Bind the line to the selected selling model via its PricebookEntry
        // (OrderItem.ProductSellingModelId is FLS-restricted for the integration user).
        const pbBySellingModel = sellingModelId
          ? pbData.records.find((r) => r.ProductSellingModelId === sellingModelId)
          : undefined
        const pbEntry =
          pbBySellingModel ??
          (billingPeriod === 'annual' && pbData.records.length > 1
            ? pbData.records[pbData.records.length - 1]
            : pbData.records[0])
        const pricebookEntryId = pbEntry.Id
        const unitPrice = pbEntry.UnitPrice ?? 0

        setLoadingStep('Looking up billing frequency…')
        const psmSoql =
          `SELECT Id, ProductSellingModelId, ProductSellingModel.Name, ProductSellingModel.PricingTermUnit, ProductSellingModel.SellingModelType ` +
          `FROM ProductSellingModelOption WHERE Product2Id = '${productId}'`
        const psmRes = await fetch(
          `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(psmSoql)}`,
        )
        let billingFrequency = billingPeriod === 'annual' ? 'Annual' : 'Monthly'
        let sellingModelType: string | undefined
        if (psmRes.ok) {
          const psmData = (await psmRes.json()) as {
            records: { ProductSellingModelId?: string; ProductSellingModel?: { Name?: string; PricingTermUnit?: string; SellingModelType?: string } }[]
          }
          const targetUnit = billingPeriod === 'annual' ? 'Annual' : 'Months'
          // Prefer the record matching the selected selling model id, then name, then billing-period unit
          const byId = sellingModelId
            ? psmData.records.find((r) => r.ProductSellingModelId === sellingModelId)
            : undefined
          const byName = psmData.records.find((r) => r.ProductSellingModel?.Name === sellingModel)
          const match =
            byId ?? byName ?? psmData.records.find((r) => r.ProductSellingModel?.PricingTermUnit === targetUnit)
          const resolvedUnit =
            match?.ProductSellingModel?.PricingTermUnit ??
            psmData.records[0]?.ProductSellingModel?.PricingTermUnit
          billingFrequency = resolvedUnit === 'Annual' ? 'Annual' : 'Monthly'
          sellingModelType = match?.ProductSellingModel?.SellingModelType
        }
        const pricingTermCount = billingFrequency === 'Monthly' ? 12 : 1
        // Evergreen order products must NOT carry an EndDate (Salesforce INVALID_INPUT otherwise)
        const isEvergreen =
          (sellingModelType ?? '').toLowerCase() === 'evergreen' || smLower.includes('evergreen')

        // ── Step 1: Place Sales Transaction (Salesforce-priced) ──────────────

        setLoadingStep('Creating order…')
        const orderRecord: Record<string, unknown> = {
          attributes: { method: 'POST', type: 'Order' },
          AccountId: accountId,
          Pricebook2Id: pricebookId,
          EffectiveDate: startDate,
          Status: 'Draft',
          ...(contactId ? { BillToContactId: contactId, ShipToContactId: contactId } : {}),
          BillingStreet: addr.BillingStreet ?? '',
          BillingCity: addr.BillingCity ?? '',
          BillingState: addr.BillingState ?? '',
          BillingPostalCode: addr.BillingPostalCode ?? '',
          BillingCountry: addr.BillingCountry ?? '',
          ShippingStreet: addr.ShippingStreet ?? addr.BillingStreet ?? '',
          ShippingCity: addr.ShippingCity ?? addr.BillingCity ?? '',
          ShippingState: addr.ShippingState ?? addr.BillingState ?? '',
          ShippingPostalCode: addr.ShippingPostalCode ?? addr.BillingPostalCode ?? '',
          ShippingCountry: addr.ShippingCountry ?? addr.BillingCountry ?? '',
        }
        const orderItemRecord: Record<string, unknown> = {
          attributes: { method: 'POST', type: 'OrderItem' },
          OrderId: '@{refOrder.id}',
          Product2Id: productId,
          PricebookEntryId: pricebookEntryId,
          Quantity: quantity,
          UnitPrice: unitPrice,
          NetUnitPrice: unitPrice,
          TotalLineAmount: unitPrice * quantity,
          PricingTermCount: pricingTermCount,
          SubscriptionTerm: 1,
          ServiceDate: startDate,
          ...(isEvergreen ? {} : { EndDate: endDate }),
          PeriodBoundary: 'Anniversary',
          BillingFrequency2: billingFrequency,
        }
        const pstBody: Record<string, unknown> = {
          pricingPref: 'System',
          catalogRatesPref: 'Fetch',
          configurationPref: {
            configurationMethod: 'Skip',
            configurationOptions: {
              validateProductCatalog: true,
              validateAmendRenewCancel: true,
              executeConfigurationRules: true,
              addDefaultConfiguration: true,
            },
          },
          taxPref: 'Skip',
          graph: {
            graphId: 'createBuyNowOrder',
            records: [
              { referenceId: 'refOrder', record: orderRecord },
              { referenceId: 'refOrderItem', record: orderItemRecord },
            ],
          },
        }
        const pstUrl = `/api/salesforce/services/data/v${apiVersion}/connect/rev/sales-transaction/actions/place`
        console.log('[BuyNow] PST URL:', pstUrl)
        console.log('[BuyNow] PST body:', JSON.stringify(pstBody, null, 2))

        const pstRes = await fetch(pstUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pstBody),
        })
        const pstData = (await pstRes.json()) as unknown
        console.log('[BuyNow] PST response status:', pstRes.status)

        if (!pstRes.ok) {
          console.error('[BuyNow] PST error:', JSON.stringify(pstData, null, 2))
          let msg = `Request failed: HTTP ${pstRes.status}`
          if (Array.isArray(pstData) && (pstData[0] as { message?: string })?.message) {
            msg = (pstData[0] as { message: string }).message
          } else if (pstData && typeof pstData === 'object' && (pstData as { message?: string }).message) {
            msg = (pstData as { message: string }).message
          }
          throw new Error(msg)
        }

        const orderId = extractOrderId(pstData)
        if (!orderId) throw new Error('No order ID returned from Place Sales Transaction API')
        console.log('[BuyNow] Order created:', orderId)

        // Save PST result into state (still loading — lifecycle steps follow)
        setState((prev) => ({
          ...prev,
          orderId,
          apiResponse: pstData,
          requestUrl: pstUrl,
          requestBody: pstBody,
          loadingStep: 'Looking up order item…',
        }))

        // ── Step 2: Get OrderItem ID ─────────────────────────────────────────

        const oiSoql = `SELECT Id FROM OrderItem WHERE OrderId = '${orderId}' LIMIT 1`
        const oiRes = await fetch(
          `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(oiSoql)}`,
        )
        if (!oiRes.ok) throw new Error(`OrderItem lookup failed: HTTP ${oiRes.status}`)
        const oiData = (await oiRes.json()) as { records: { Id: string }[] }
        if (!oiData.records.length) throw new Error('OrderItem not found after order creation')
        const orderItemId = oiData.records[0].Id

        // ── Step 3: Create OrderAction ───────────────────────────────────────

        const oaUrl = `/api/salesforce/services/data/v${apiVersion}/sobjects/OrderAction`
        const oaBody = { OrderId: orderId, Type: 'Add' }
        const oaIdx = addStep({ name: 'Create OrderAction', status: 'running', method: 'POST', url: oaUrl, requestBody: oaBody })
        setLoadingStep('Creating OrderAction…')

        const oaRes = await fetch(oaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(oaBody),
        })
        const oaData = (await oaRes.json()) as unknown
        if (!oaRes.ok) {
          patchStep(oaIdx, { status: 'error', response: oaData, error: `HTTP ${oaRes.status}` })
          throw new Error(`OrderAction creation failed: HTTP ${oaRes.status}`)
        }
        const orderActionId = (oaData as { id?: string }).id ?? ''
        patchStep(oaIdx, { status: 'done', response: oaData })
        console.log('[BuyNow] OrderAction created:', orderActionId)

        // ── Step 4: Patch OrderItem with OrderActionId ───────────────────────

        const oiPatchUrl = `/api/salesforce/services/data/v${apiVersion}/sobjects/OrderItem/${orderItemId}`
        const oiPatchBody = { OrderActionId: orderActionId }
        const oiPatchIdx = addStep({ name: 'Link OrderItem → OrderAction', status: 'running', method: 'PATCH', url: oiPatchUrl, requestBody: oiPatchBody })
        setLoadingStep('Linking OrderItem…')

        const oiPatchRes = await fetch(oiPatchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(oiPatchBody),
        })
        // PATCH returns 204 No Content on success
        if (!oiPatchRes.ok && oiPatchRes.status !== 204) {
          const errText = await oiPatchRes.text()
          patchStep(oiPatchIdx, { status: 'error', error: `HTTP ${oiPatchRes.status}: ${errText}` })
          throw new Error(`OrderItem patch failed: HTTP ${oiPatchRes.status}`)
        }
        patchStep(oiPatchIdx, { status: 'done', response: { status: oiPatchRes.status } })
        console.log('[BuyNow] OrderItem linked to OrderAction')

        // ── Step 5: Create AppUsageAssignment ───────────────────────────────

        const auaUrl = `/api/salesforce/services/data/v${apiVersion}/sobjects/AppUsageAssignment`
        const auaBody = { RecordId: orderId, AppUsageType: 'RevenueLifecycleManagement' }
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
        console.log('[BuyNow] AppUsageAssignment created')

        // 2-second processing delay (same as Start Trial)
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // ── Step 6: Activate Order (up to 3 retries) ────────────────────────

        const actUrl = `/api/salesforce/services/data/v${apiVersion}/sobjects/Order/${orderId}`
        const actBody = { Status: 'Activated' }
        const actIdx = addStep({ name: 'Activate Order', status: 'running', method: 'PATCH', url: actUrl, requestBody: actBody })
        setLoadingStep('Activating order…')

        let activated = false
        let lastActResponse: unknown = null
        for (let attempt = 1; attempt <= 3; attempt++) {
          if (attempt > 1) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 1500))
          }
          const actRes = await fetch(actUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(actBody),
          })
          if (actRes.ok || actRes.status === 204) {
            lastActResponse = { status: actRes.status }
            activated = true
            break
          }
          const errText = await actRes.text()
          lastActResponse = { status: actRes.status, body: errText }
          if (errText.includes('ALREADY_ACTIVATED') || errText.includes('Status: Activated')) {
            activated = true
            break
          }
          console.warn(`[BuyNow] Activation attempt ${attempt} failed:`, errText)
        }

        if (!activated) {
          patchStep(actIdx, { status: 'error', response: lastActResponse, error: 'Order could not be activated after 3 attempts' })
          throw new Error('Order could not be activated after 3 attempts')
        }
        patchStep(actIdx, { status: 'done', response: lastActResponse })
        console.log('[BuyNow] Order activated:', orderId)

        // ── All done ─────────────────────────────────────────────────────────

        setState((prev) => ({
          ...prev,
          status: 'success',
          loadingStep: null,
        }))
      } catch (e: unknown) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          loadingStep: null,
          error: e instanceof Error ? e.message : 'An unexpected error occurred.',
          lifecycleSteps: [...stepsRef.current],
        }))
      }
    },
    [orgInfo.apiVersion, config.pricebookId],
  )

  const reset = useCallback(() => {
    stepsRef.current = []
    setState(IDLE)
  }, [])

  return { submit, state, reset }
}

function extractOrderId(data: unknown): string | null {
  try {
    const d = data as Record<string, unknown>
    if (typeof d['salesTransactionId'] === 'string') return d['salesTransactionId']
    const graphs = d['graphs']
    const composite = graphs
      ? ((graphs as { graphResponse?: { compositeResponse?: unknown[] } }[])[0]?.graphResponse?.compositeResponse)
      : (d['compositeResponse'] as unknown[] | undefined)
    if (!Array.isArray(composite)) return null
    for (const entry of composite as { referenceId?: string; body?: { id?: string } }[]) {
      if (entry.referenceId === 'refOrder' && entry.body?.id) return entry.body.id
    }
    return null
  } catch {
    return null
  }
}
