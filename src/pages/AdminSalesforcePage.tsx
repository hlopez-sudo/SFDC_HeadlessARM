import { useEffect, useState } from 'react'
import { RefreshCw, CheckCircle, XCircle, Save } from 'lucide-react'
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
// Page
// ---------------------------------------------------------------------------

export function AdminSalesforcePage() {
  const { refresh, loading } = useSalesforceConfig()

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

      <HeadlessPricingConfigSection />
    </div>
  )
}
