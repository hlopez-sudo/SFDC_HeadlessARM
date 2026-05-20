import { useEffect, useState } from 'react'
import { RefreshCw, CheckCircle, XCircle, Save, User2 } from 'lucide-react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import { useHeadlessPricingConfig } from '../salesforce/HeadlessPricingConfigContext'
import type { HeadlessPricingConfig } from '../salesforce/headlessPricingConfig'
import { SalesforceLookupInput } from '../components/salesforce/SalesforceLookupInput'
import styles from './AdminPage.module.css'
import local from './AdminSalesforcePage.module.css'

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className={local.infoRow}>
      <span className={local.infoLabel}>{label}</span>
      <code className={local.infoValue}>{value}</code>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OAuth UI config persistence
// ---------------------------------------------------------------------------

const SF_OAUTH_CONFIG_KEY = 'genericCommerce.sfOAuthConfig'

type SfOAuthUIConfig = { loginUrl: string }

function loadOAuthUIConfig(): SfOAuthUIConfig {
  try {
    const raw = localStorage.getItem(SF_OAUTH_CONFIG_KEY)
    return raw ? (JSON.parse(raw) as SfOAuthUIConfig) : { loginUrl: 'https://login.salesforce.com' }
  } catch {
    return { loginUrl: 'https://login.salesforce.com' }
  }
}

function saveOAuthUIConfig(cfg: SfOAuthUIConfig): void {
  localStorage.setItem(SF_OAUTH_CONFIG_KEY, JSON.stringify(cfg))
}

// ---------------------------------------------------------------------------
// Lookup meta persistence
// ---------------------------------------------------------------------------

const LOOKUP_META_KEY = 'genericCommerce.headlessPricing.lookupMeta'

type LookupMeta = {
  contextDefinitionId?: Record<string, string>
  contextMappingId?: Record<string, string>
}

function loadLookupMeta(): LookupMeta {
  try {
    const raw = localStorage.getItem(LOOKUP_META_KEY)
    return raw ? (JSON.parse(raw) as LookupMeta) : {}
  } catch {
    return {}
  }
}

function saveLookupMeta(meta: LookupMeta) {
  localStorage.setItem(LOOKUP_META_KEY, JSON.stringify(meta))
}

// ---------------------------------------------------------------------------
// Active account persistence
// ---------------------------------------------------------------------------

const ACTIVE_ACCOUNT_KEY = 'fc-active-account'

type ActiveAccountData = { accountId: string; accountName: string }

function loadActiveAccount(): ActiveAccountData | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ACCOUNT_KEY)
    return raw ? (JSON.parse(raw) as ActiveAccountData) : null
  } catch { return null }
}

function saveActiveAccount(data: ActiveAccountData): void {
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(data))
}

function clearActiveAccount(): void {
  localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
}

// ---------------------------------------------------------------------------
// SalesforceConnectSection
// ---------------------------------------------------------------------------

type DeviceFlowState =
  | { phase: 'idle' }
  | { phase: 'waiting'; sessionId: string; verificationUri: string; interval: number }
  | { phase: 'error'; message: string }

function SalesforceConnectSection() {
  const { orgInfo, refresh, loading, isOAuthConnected } = useSalesforceConfig()

  const [savedConfig] = useState<SfOAuthUIConfig>(loadOAuthUIConfig)
  const [loginUrlType, setLoginUrlType] = useState<'production' | 'sandbox' | 'custom'>(() => {
    const u = savedConfig.loginUrl
    if (u === 'https://login.salesforce.com') return 'production'
    if (u === 'https://test.salesforce.com') return 'sandbox'
    return 'custom'
  })
  const [customLoginUrl, setCustomLoginUrl] = useState(
    loginUrlType === 'custom' ? savedConfig.loginUrl : '',
  )
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState>({ phase: 'idle' })

  const resolvedLoginUrl =
    loginUrlType === 'production' ? 'https://login.salesforce.com'
    : loginUrlType === 'sandbox' ? 'https://test.salesforce.com'
    : customLoginUrl

  // Poll every 3 seconds while waiting for the user to approve in Salesforce
  useEffect(() => {
    if (deviceFlow.phase !== 'waiting') return
    const { sessionId } = deviceFlow

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/sf-config/oauth/poll?sessionId=${sessionId}`)
        const data = await res.json() as { status: string; message?: string }

        if (data.status === 'connected') {
          clearInterval(timer)
          setDeviceFlow({ phase: 'idle' })
          void refresh()
        } else if (data.status === 'expired' || data.status === 'error') {
          clearInterval(timer)
          setDeviceFlow({ phase: 'error', message: data.message ?? 'Authorization expired. Please try again.' })
        }
        // 'pending' → keep polling
      } catch {
        // network hiccup — keep polling
      }
    }, 3000)

    return () => clearInterval(timer)
  }, [deviceFlow, refresh])

  async function handleConnect() {
    if (loginUrlType === 'custom' && !customLoginUrl.startsWith('https://')) {
      setDeviceFlow({ phase: 'error', message: 'Custom login URL must start with https://' })
      return
    }
    setDeviceFlow({ phase: 'idle' })
    saveOAuthUIConfig({ loginUrl: resolvedLoginUrl })

    try {
      const res = await fetch(`/api/sf-config/oauth/init?loginUrl=${encodeURIComponent(resolvedLoginUrl)}`)
      const data = await res.json() as { sessionId?: string; authUrl?: string; error?: string }

      if (!res.ok || !data.sessionId || !data.authUrl) {
        setDeviceFlow({ phase: 'error', message: data.error ?? 'Failed to start login. Check the server log.' })
        return
      }

      // Open the Salesforce login page in a new tab
      window.open(data.authUrl, '_blank', 'noopener,noreferrer')

      setDeviceFlow({
        phase: 'waiting',
        sessionId: data.sessionId,
        verificationUri: data.authUrl,
        interval: 3,
      })
    } catch (e) {
      setDeviceFlow({ phase: 'error', message: (e as Error).message })
    }
  }

  async function handleDisconnect() {
    await fetch('/api/sf-config/logout', { method: 'POST' })
    void refresh()
  }

  // Connected view
  if (isOAuthConnected && orgInfo.connected) {
    return (
      <div className={local.card}>
        <div className={local.configCardHeader}>
          <p className={local.cardTitle}>Salesforce Connection</p>
          <span className={local.badgeOk}><CheckCircle size={12} /> Connected</span>
        </div>
        <InfoRow label="Username" value={orgInfo.username} />
        <InfoRow label="Instance URL" value={orgInfo.instanceUrl} />
        <InfoRow label="Org ID" value={orgInfo.orgId} />
        <InfoRow label="API Version" value={orgInfo.apiVersion} />
        <div className={local.formActions}>
          <button
            type="button"
            className={local.disconnectBtn}
            onClick={() => { void handleDisconnect() }}
            disabled={loading}
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  // Waiting for user to approve in Salesforce
  if (deviceFlow.phase === 'waiting') {
    return (
      <div className={local.card}>
        <div className={local.configCardHeader}>
          <p className={local.cardTitle}>Salesforce Connection</p>
          <span className={local.badgeOff}><RefreshCw size={12} className={local.spin} /> Waiting for approval…</span>
        </div>
        <p className={styles.muted} style={{ marginBottom: 12 }}>
          A Salesforce login tab was opened. Log in and this page will connect automatically.
        </p>
        <p className={styles.muted}>
          Tab didn't open?{' '}
          <a href={deviceFlow.verificationUri} target="_blank" rel="noopener noreferrer" className={local.link}>
            Click here to open Salesforce login
          </a>
        </p>
        <div className={local.formActions} style={{ marginTop: 16 }}>
          <button
            type="button"
            className={local.disconnectBtn}
            onClick={() => setDeviceFlow({ phase: 'idle' })}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Connect form (idle or error)
  return (
    <div className={local.card}>
      <div className={local.configCardHeader}>
        <p className={local.cardTitle}>Salesforce Connection</p>
        {!isOAuthConnected && orgInfo.connected && (
          <span className={local.badgeOff}>Using env-var credentials</span>
        )}
      </div>

      {deviceFlow.phase === 'error' && (
        <div className={local.oauthError}>
          <XCircle size={14} />
          {deviceFlow.message}
        </div>
      )}

      <p className={local.formSectionLabel}>Environment</p>
      <div className={local.radioGroup}>
        {(['production', 'sandbox', 'custom'] as const).map((opt) => (
          <label key={opt} className={local.radioLabel}>
            <input
              type="radio"
              name="loginUrlType"
              value={opt}
              checked={loginUrlType === opt}
              onChange={() => { setLoginUrlType(opt); setDeviceFlow({ phase: 'idle' }) }}
            />
            {opt === 'production' ? 'Production (login.salesforce.com)'
             : opt === 'sandbox' ? 'Sandbox (test.salesforce.com)'
             : 'Custom domain'}
          </label>
        ))}
      </div>

      {loginUrlType === 'custom' && (
        <input
          className={local.textInput}
          value={customLoginUrl}
          onChange={(e) => { setCustomLoginUrl(e.target.value); setDeviceFlow({ phase: 'idle' }) }}
          placeholder="https://mydomain.my.salesforce.com"
          autoComplete="off"
          spellCheck={false}
          style={{ marginBottom: 12 }}
        />
      )}

      <div className={local.formActions} style={{ marginTop: 16 }}>
        <button
          type="button"
          className={local.runBtn}
          onClick={() => { void handleConnect() }}
          disabled={loading}
        >
          Connect with Salesforce
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActiveAccountSection
// ---------------------------------------------------------------------------

function ActiveAccountSection({ isConnected }: { isConnected: boolean }) {
  const { orgInfo } = useSalesforceConfig()
  const apiVersion = orgInfo.apiVersion || '62.0'

  const stored = loadActiveAccount()
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(stored?.accountId ?? null)
  const [accountName, setAccountName] = useState<string | null>(stored?.accountName ?? null)
  const [selectedId, setSelectedId] = useState('')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  function handleSet() {
    if (!selectedId) return
    setSaveState('saving')
    try {
      const name = selectedName ?? selectedId
      saveActiveAccount({ accountId: selectedId, accountName: name })
      setCurrentAccountId(selectedId)
      setAccountName(name)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    }
  }

  function handleClear() {
    clearActiveAccount()
    setCurrentAccountId(null)
    setAccountName(null)
    setSelectedId('')
    setSelectedName(null)
  }

  return (
    <div className={local.card}>
      <div className={local.configCardHeader}>
        <User2 size={14} className={local.iconOff} />
        <p className={local.cardTitle}>Active Account</p>
        {currentAccountId && (
          <span className={local.badgeOk}>
            <CheckCircle size={11} />
            Account Set
          </span>
        )}
      </div>

      {!isConnected && (
        <div className={local.oauthError}>
          Connect to Salesforce above before selecting an account.
        </div>
      )}

      {currentAccountId && (
        <div className={local.infoRow} style={{ marginBottom: 12 }}>
          <span className={local.infoLabel}>Current Account</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            {accountName && (
              <code className={local.infoValue} style={{ display: 'block' }}>{accountName}</code>
            )}
            <code className={local.infoValue}>{currentAccountId}</code>
          </span>
          <button
            type="button"
            className={local.disconnectBtn}
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      )}

      <div className={local.field}>
        <label className={local.fieldLabel}>
          {currentAccountId ? 'Change Account' : 'Select Account'}
        </label>
        <SalesforceLookupInput
          value={selectedId}
          onChange={setSelectedId}
          onSelect={(rec) => {
            setSelectedId((rec as { Id?: string }).Id ?? '')
            setSelectedName((rec as { Name?: string }).Name ?? null)
          }}
          sObject="Account"
          queryFields={['Id', 'Name']}
          searchFields={['Name']}
          valueField="Id"
          displayField="Name"
          orderBy="Name ASC"
          placeholder="Search accounts…"
          apiVersion={apiVersion}
        />
      </div>

      <div className={local.formActions}>
        <button
          type="button"
          className={local.runBtn}
          disabled={!selectedId || saveState === 'saving' || !isConnected}
          onClick={handleSet}
        >
          {saveState === 'saving' ? 'Saving…' : 'Set Account'}
        </button>
        {saveState === 'saved' && (
          <span className={local.savedHint} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={13} />
            Account saved.
          </span>
        )}
        {saveState === 'error' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#b91c1c', fontWeight: 500 }}>
            <XCircle size={13} />
            Failed to save account.
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HeadlessPricingConfigSection
// ---------------------------------------------------------------------------

function HeadlessPricingConfigSection() {
  const { config, setConfig, isComplete } = useHeadlessPricingConfig()
  const { orgInfo } = useSalesforceConfig()
  const apiVersion = orgInfo.apiVersion || '62.0'

  const [local_, setLocal] = useState<HeadlessPricingConfig>(config)
  const [saved, setSaved] = useState(false)
  const [lookupMeta, setLookupMeta] = useState<LookupMeta>(loadLookupMeta)

  useEffect(() => {
    setLocal(config)
  }, [config])

  function setMeta(key: keyof LookupMeta, rec: Record<string, unknown>, paths: string[]) {
    const flat: Record<string, string> = {}
    function getPath(obj: unknown, path: string): string {
      const parts = path.split('.')
      let cur: unknown = obj
      for (const part of parts) {
        if (cur == null || typeof cur !== 'object') return ''
        cur = (cur as Record<string, unknown>)[part]
      }
      return cur != null ? String(cur) : ''
    }
    for (const path of paths) {
      const val = getPath(rec, path)
      if (val) flat[path] = val
    }
    const updated = { ...lookupMeta, [key]: flat }
    setLookupMeta(updated)
    saveLookupMeta(updated)
  }

  function field<K extends keyof HeadlessPricingConfig>(key: K, value: HeadlessPricingConfig[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function save() {
    setConfig(local_)
    setSaved(true)
  }

  return (
    <div className={local.card}>
      <div className={local.configCardHeader}>
        <p className={local.cardTitle}>Headless Pricing Configuration</p>
        {isComplete
          ? <span className={local.badgeOk}><CheckCircle size={12} /> Active</span>
          : <span className={local.badgeOff}>Not configured — product detail pages will use /connect/pricing</span>
        }
      </div>

      <p className={styles.muted}>
        IDs saved here are used by every product detail page to call{' '}
        <code className={local.inlineCode}>runSalesforceHeadlessPricing</code>. Optional fields (for
        example <code className={local.inlineCode}>discoveryProcedure</code>) are merged into the
        invocable action input when set. Leave the required fields blank to use the /connect/pricing
        fallback instead.
      </p>

      <p className={local.formSectionLabel}>Required</p>
      <label className={local.field}>
        <span className={local.fieldLabelRow}>
          <span className={local.fieldLabel}>contextDefinitionId</span>
          <span className={local.fieldLabelHelp}>
            Searches for API Name of ContextDefinition and returns the ID: If using QuantumBit search for{' '}
            <strong>RLM_SalesTransactionContext</strong>
          </span>
        </span>
        <SalesforceLookupInput
          value={local_.contextDefinitionId}
          onChange={(v) => field('contextDefinitionId', v)}
          sObject="ContextDefinition"
          queryFields={['Id', 'DeveloperName', 'Description']}
          searchFields={['DeveloperName', 'Description']}
          valueField="Id"
          displayField="DeveloperName"
          subLabelField="Description"
          orderBy="DeveloperName ASC"
          apiVersion={apiVersion}
          onSelect={(rec) => setMeta('contextDefinitionId', rec, ['Id', 'DeveloperName', 'Description'])}
          metaFields={[
            { label: 'Id', field: 'Id' },
            { label: 'DeveloperName', field: 'DeveloperName' },
            { label: 'Description', field: 'Description' },
          ]}
          metaValues={lookupMeta.contextDefinitionId}
        />
      </label>
      <label className={local.field}>
        <span className={local.fieldLabelRow}>
          <span className={local.fieldLabel}>contextMappingId</span>
          <span className={local.fieldLabelHelp}>
            Searches for Description from ContextMapping: If using QuantumBit search for{' '}
            <strong>Mapping to map entities related to pricing elements</strong>
          </span>
        </span>
        <SalesforceLookupInput
          value={local_.contextMappingId}
          onChange={(v) => field('contextMappingId', v)}
          sObject="ContextMapping"
          queryFields={['Id', 'Description', 'ContextDefinitionVersionId', 'ContextDefinitionVersion.ContextDefinition.DeveloperName']}
          searchFields={['Description']}
          valueField="Id"
          displayField="Description"
          subLabelField="ContextDefinitionVersion.ContextDefinition.DeveloperName"
          orderBy="Description ASC"
          apiVersion={apiVersion}
          onSelect={(rec) => setMeta('contextMappingId', rec, [
            'Id',
            'Description',
            'ContextDefinitionVersionId',
            'ContextDefinitionVersion.ContextDefinition.DeveloperName',
          ])}
          metaFields={[
            { label: 'Id', field: 'Id' },
            { label: 'Description', field: 'Description' },
            { label: 'CtxDefVersionId', field: 'ContextDefinitionVersionId' },
            { label: 'CtxDef', field: 'ContextDefinitionVersion.ContextDefinition.DeveloperName' },
          ]}
          metaValues={lookupMeta.contextMappingId}
        />
      </label>
      <label className={local.field}>
        <span className={local.fieldLabelRow}>
          <span className={local.fieldLabel}>pricingProcedureId</span>
          <span className={local.fieldLabelHelp}>
            Searches Expression Set and returns API Name of Pricing Procedure: If using QuantumBit search for{' '}
            <strong>RLM_DefaultPricingProcedure</strong>
          </span>
        </span>
        <SalesforceLookupInput
          value={local_.pricingProcedureId}
          onChange={(v) => field('pricingProcedureId', v)}
          sObject="ExpressionSetDefinition"
          queryFields={['Id', 'DeveloperName', 'MasterLabel']}
          searchFields={['MasterLabel', 'DeveloperName']}
          valueField="DeveloperName"
          displayField="MasterLabel"
          subLabelField="DeveloperName"
          orderBy="MasterLabel ASC"
          placeholder="18-char Id or API name"
          apiVersion={apiVersion}
        />
      </label>
      <label className={local.field}>
        <span className={local.fieldLabel}>pricebookId</span>
        <SalesforceLookupInput
          value={local_.pricebookId}
          onChange={(v) => field('pricebookId', v)}
          sObject="Pricebook2"
          queryFields={['Id', 'Name', 'IsStandard']}
          searchFields={['Name']}
          valueField="Id"
          displayField="Name"
          subLabelField="Id"
          orderBy="IsStandard DESC, Name ASC"
          extraWhere="IsActive = true"
          placeholder="18-char Pricebook2 Id"
          apiVersion={apiVersion}
        />
      </label>

      <p className={local.formSectionLabel}>Optional</p>
      <label className={local.field}>
        <span className={local.fieldLabel}>discoveryProcedure</span>
        <SalesforceLookupInput
          value={local_.discoveryProcedure}
          onChange={(v) => field('discoveryProcedure', v)}
          sObject="ExpressionSetDefinition"
          queryFields={['Id', 'DeveloperName', 'MasterLabel']}
          searchFields={['MasterLabel', 'DeveloperName']}
          valueField="DeveloperName"
          displayField="MasterLabel"
          subLabelField="DeveloperName"
          orderBy="MasterLabel ASC"
          placeholder="RLM_DefaultPricingDiscoveryProcedure"
          apiVersion={apiVersion}
        />
        <p className={local.fieldHint}>
          If blank be sure to mark &quot;skipDiscovery&quot; boolean to TRUE.
        </p>
      </label>
      <label className={local.field}>
        <span className={local.fieldLabel}>effectiveDate</span>
        <input
          className={local.textInput}
          value={local_.effectiveDate}
          onChange={(e) => field('effectiveDate', e.target.value)}
          placeholder="2023-11-16T12:20:00.000Z"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className={local.field}>
        <span className={local.fieldLabelRow}>
          <span className={local.fieldLabel}>quoteStartDate</span>
          <span className={local.fieldLabelHelp}>Used as StartDate on QuoteLineItems — defaults to today if blank</span>
        </span>
        <input
          type="date"
          className={local.textInput}
          value={local_.quoteStartDate}
          onChange={(e) => field('quoteStartDate', e.target.value)}
        />
      </label>
      <label className={local.field}>
        <span className={local.fieldLabelRow}>
          <span className={local.fieldLabel}>quoteEndDate</span>
          <span className={local.fieldLabelHelp}>Used as EndDate on QuoteLineItems — defaults to start date + 1 year if blank</span>
        </span>
        <input
          type="date"
          className={local.textInput}
          value={local_.quoteEndDate}
          onChange={(e) => field('quoteEndDate', e.target.value)}
        />
      </label>

      <div className={local.checkboxGrid}>
        {(
          [
            ['displayContext', 'displayContext'],
            ['isHighVolumeLineItems', 'isHighVolumeLineItems'],
            ['isSkipWaterfall', 'isSkipWaterfall'],
            ['persistContext', 'persistContext'],
            ['skipDiscovery', 'skipDiscovery'],
            ['taggedData', 'taggedData'],
            ['useSessionScopedContext', 'useSessionScopedContext'],
          ] as [keyof HeadlessPricingConfig, string][]
        ).map(([key, label]) => (
          <label key={key} className={local.checkLabel}>
            <input
              type="checkbox"
              checked={local_[key] as boolean}
              onChange={(e) => field(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>

      <div className={local.formActions}>
        <button type="button" className={local.runBtn} onClick={save}>
          <Save size={14} />
          Save configuration
        </button>
        {saved && <span className={local.savedHint}>Saved</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PstTestSection
// ---------------------------------------------------------------------------

function PstTestSection({ isConnected }: { isConnected: boolean }) {
  const { orgInfo } = useSalesforceConfig()
  const { config } = useHeadlessPricingConfig()
  const [productId, setProductId] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [requestBody, setRequestBody] = useState<string | null>(null)
  const [responseBody, setResponseBody] = useState<string | null>(null)

  async function runTest() {
    if (!productId.trim() || !config.pricebookId.trim()) return
    setStatus('loading')
    setRequestBody(null)
    setResponseBody(null)

    const apiVersion = orgInfo.apiVersion || '62.0'
    const today = new Date().toISOString().split('T')[0]
    const startDate = config.quoteStartDate.trim() || today
    const endDate = config.quoteEndDate.trim() || (() => {
      const d = new Date(startDate)
      d.setFullYear(d.getFullYear() + 1)
      return d.toISOString().split('T')[0]
    })()

    try {
      const soql =
        `SELECT Id, Product2Id FROM PricebookEntry ` +
        `WHERE Product2Id = '${productId.trim()}' AND Pricebook2Id = '${config.pricebookId.trim()}' AND IsActive = true`
      const pbRes = await fetch(`/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(soql)}`)
      const pbData = (await pbRes.json()) as { records?: { Id: string }[] }
      const pricebookEntryId = pbData.records?.[0]?.Id
      if (!pricebookEntryId) {
        throw new Error(
          `No active PricebookEntry found.\n\nPricebookEntry query response:\n${JSON.stringify(pbData, null, 2)}`,
        )
      }

      const body = {
        pricingPref: 'Force',
        taxPref: 'Skip',
        graph: {
          graphId: 'testQuote',
          records: [
            {
              referenceId: 'refQuote',
              record: {
                attributes: { type: 'Quote', method: 'POST' },
                Name: `[PST Test] ${today}`,
                Pricebook2Id: config.pricebookId.trim(),
              },
            },
            {
              referenceId: 'refLine0',
              record: {
                attributes: { type: 'QuoteLineItem', method: 'POST' },
                QuoteId: '@{refQuote.id}',
                Product2Id: productId.trim(),
                PricebookEntryId: pricebookEntryId,
                Quantity: 1,
                StartDate: startDate,
                EndDate: endDate,
              },
            },
          ],
        },
      }
      setRequestBody(JSON.stringify(body, null, 2))

      const pstRes = await fetch(
        `/api/salesforce/services/data/v${apiVersion}/connect/rev/sales-transaction/actions/place`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      )
      const pstData = (await pstRes.json()) as unknown
      setResponseBody(JSON.stringify(pstData, null, 2))
      setStatus((pstData as Record<string, unknown>)?.isSuccess === true ? 'ok' : 'err')
    } catch (e) {
      setResponseBody((e as Error).message)
      setStatus('err')
    }
  }

  return (
    <div className={local.card}>
      <div className={local.configCardHeader}>
        <p className={local.cardTitle}>PST API Test</p>
        {status === 'ok' && (
          <span className={local.badgeOk}>
            <CheckCircle size={12} /> isSuccess: true
          </span>
        )}
        {status === 'err' && (
          <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <XCircle size={12} /> Failed
          </span>
        )}
      </div>
      <p className={styles.muted}>
        Fire a minimal Place Sales Transaction (1 Quote + 1 line item) using the current Headless Pricing
        Config. Reads pricebookId, quoteStartDate, and quoteEndDate from the section above.
      </p>
      {!isConnected && (
        <div className={local.oauthError}>Connect to Salesforce before running a test.</div>
      )}
      {isConnected && !config.pricebookId.trim() && (
        <div className={local.oauthError}>Set Pricebook ID in Headless Pricing Config above before testing.</div>
      )}
      <label className={local.field}>
        <span className={local.fieldLabel}>Test Product2 ID</span>
        <input
          className={local.textInput}
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="01t…"
          autoComplete="off"
          spellCheck={false}
          disabled={status === 'loading'}
        />
      </label>
      <div className={local.formActions}>
        <button
          type="button"
          className={local.runBtn}
          disabled={!isConnected || !productId.trim() || !config.pricebookId.trim() || status === 'loading'}
          onClick={() => { void runTest() }}
        >
          {status === 'loading' ? (
            <><RefreshCw size={13} className={local.spin} /> Running…</>
          ) : (
            'Run PST Test'
          )}
        </button>
      </div>
      {requestBody && (
        <>
          <p className={local.formSectionLabel}>Request Body</p>
          <pre className={local.preBlock}>{requestBody}</pre>
        </>
      )}
      {responseBody && (
        <>
          <p className={local.formSectionLabel}>Response</p>
          <pre className={status === 'ok' ? local.preBlockOk : local.preBlockErr}>{responseBody}</pre>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AdminSalesforcePage() {
  const { refresh, loading, isOAuthConnected } = useSalesforceConfig()

  return (
    <div className={styles.wrap}>
      <div className={local.header}>
        <h1 className={styles.title}>Salesforce</h1>
        <button
          className={local.refreshBtn}
          onClick={() => { void refresh() }}
          disabled={loading}
          title="Refresh connection"
        >
          <RefreshCw size={14} className={loading ? local.spin : undefined} />
          Refresh
        </button>
      </div>

      <SalesforceConnectSection />

      <ActiveAccountSection isConnected={isOAuthConnected} />

      <HeadlessPricingConfigSection />

      <PstTestSection isConnected={isOAuthConnected} />
    </div>
  )
}
