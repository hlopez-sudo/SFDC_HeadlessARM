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

function HeadlessPricingConfigSection() {
  const { config, setConfig, isComplete } = useHeadlessPricingConfig()
  const { orgInfo } = useSalesforceConfig()
  const apiVersion = orgInfo.apiVersion || '62.0'

  const [local_, setLocal] = useState<HeadlessPricingConfig>(config)
  const [saved, setSaved] = useState(false)
  const [lookupMeta, setLookupMeta] = useState<LookupMeta>(loadLookupMeta)

  // Keep local form in sync if config changes from another source
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
        <span className={local.fieldLabel}>contextDefinitionId</span>
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
        <span className={local.fieldLabel}>contextMappingId</span>
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
        <span className={local.fieldLabel}>pricingProcedureId</span>
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
          Expression Set definition <code className={local.inlineCode}>DeveloperName</code> from{' '}
          <code className={local.inlineCode}>ExpressionSetDefinition</code> — not the 18-character
          record Id.
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

export function AdminSalesforcePage() {
  const { orgInfo, refresh, loading } = useSalesforceConfig()

  return (
    <div className={styles.wrap}>
      <div className={local.header}>
        <h1 className={styles.title}>Salesforce</h1>
        <button
          className={local.refreshBtn}
          onClick={refresh}
          disabled={loading}
          title="Re-read org from Salesforce CLI"
        >
          <RefreshCw size={14} className={loading ? local.spin : undefined} />
          Refresh
        </button>
      </div>

      {/* Connection status */}
      <div className={local.statusBadge}>
        {orgInfo.connected ? (
          <>
            <CheckCircle size={16} className={local.iconOk} />
            <span>
              Connected to <strong>{orgInfo.alias || orgInfo.username}</strong>
            </span>
          </>
        ) : (
          <>
            <XCircle size={16} className={local.iconOff} />
            <span>
              {orgInfo.connectionError
                ? <>Not connected — <strong>{orgInfo.connectionError}</strong>. Run <code>sf config set target-org &lt;alias&gt;</code> to switch to a valid org, then click Refresh.</>
                : orgInfo.instanceUrl
                  ? <>Credentials found for <strong>{orgInfo.alias || orgInfo.instanceUrl}</strong> but API is unreachable. The org may be expired. Run <code>sf org login web --set-default</code>.</>
                  : 'No org connected. See instructions below.'}
            </span>
          </>
        )}
      </div>

      {/* Org details */}
      {orgInfo.connected && (
        <div className={local.card}>
          <p className={local.cardTitle}>Connected Org</p>
          <InfoRow label="Alias" value={orgInfo.alias} />
          <InfoRow label="Username" value={orgInfo.username} />
          <InfoRow label="Instance URL" value={orgInfo.instanceUrl} />
          <InfoRow label="Org ID" value={orgInfo.orgId} />
          <InfoRow label="API Version" value={orgInfo.apiVersion} />
        </div>
      )}

      <HeadlessPricingConfigSection />

      {/* Instructions */}
      <div className={local.instructions}>
        <p className={local.instrTitle}>How to connect</p>
        <p className={styles.muted}>
          This app reads credentials directly from the Salesforce CLI. No passwords or tokens are
          entered here. The connection updates automatically every 30 seconds.
        </p>
        <ol className={local.steps}>
          <li>
            Log in and set as default in the CLI:
            <code className={local.code}>sf org login web --set-default</code>
          </li>
          <li>
            Click <strong>Refresh</strong> above (or wait up to 30 seconds).
          </li>
        </ol>
        <p className={styles.muted}>
          To switch to a different org that's already authenticated:
          <code className={local.code}>sf config set target-org &lt;alias&gt;</code>
          Then click <strong>Refresh</strong>.
        </p>
      </div>
    </div>
  )
}
