import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText, Layers, Receipt, Search, ShoppingBag, X } from 'lucide-react'
import { useAccountQuotes, type QuoteRecord } from '../hooks/useAccountQuotes'
import { useAccountOrders, type OrderRecord } from '../hooks/useAccountOrders'
import { useAccountAssets, type AssetRecord } from '../hooks/useAccountAssets'
import { useAccountInvoices, type InvoiceRecord } from '../hooks/useAccountInvoices'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import {
  ASSET_ACTIONS,
  selectionEligibility,
  sellingModelLabel,
  type AssetActionDef,
} from '../salesforce/assetActions'
import { AssetActionDrawer } from '../components/assets/AssetActionDrawer'
import { formatDate, formatMoney, formatSignedNumber } from '../lib/format'
import styles from './DashboardPage.module.css'

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

const ACTION_VARIANT_CLASS: Record<AssetActionDef['variant'], string> = {
  primary: styles.btnPrimary,
  secondary: styles.btnSecondary,
  danger: styles.btnDangerOutline,
}

function StatusChip({ status }: { status: string | null | undefined }) {
  const lower = (status ?? '').toLowerCase()
  let variant = styles.statusDefault
  if (lower === 'activated' || lower === 'active') variant = styles.statusActive
  else if (lower === 'cancelled' || lower === 'canceled') variant = styles.statusCancelled
  else if (lower === 'draft') variant = styles.statusDraft
  else if (lower === 'closed') variant = styles.statusClosed
  return <span className={`${styles.statusChip} ${variant}`}>{status ?? '—'}</span>
}

function SpinnerRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className={styles.emptyRow}>
        <span className={styles.spinner} aria-label="Loading" />
      </td>
    </tr>
  )
}

function ErrorRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} className={styles.errorRow}>
        {message}
      </td>
    </tr>
  )
}

function EmptyRow({ cols, message = 'No records found.' }: { cols: number; message?: string }) {
  return (
    <tr>
      <td colSpan={cols} className={styles.emptyRow}>
        {message}
      </td>
    </tr>
  )
}

function filterBySearch<T>(records: T[], query: string, fields: (r: T) => (string | null)[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return records
  return records.filter((r) => fields(r).some((v) => v?.toLowerCase().includes(q)))
}

function noMatchMessage(query: string): string {
  return `No matches for "${query.trim()}".`
}

type SectionSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  matchCount: number
  total: number
}

function SectionSearch({ value, onChange, placeholder, matchCount, total }: SectionSearchProps) {
  return (
    <div className={styles.searchBar}>
      <div className={styles.searchField}>
        <Search size={14} strokeWidth={2} className={styles.searchIcon} aria-hidden />
        <input
          type="search"
          className={styles.searchInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {value && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => onChange('')}
            aria-label="Clear search"
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>
      {value.trim() && (
        <span className={styles.searchCount}>
          {matchCount} of {total}
        </span>
      )}
    </div>
  )
}

type CollapsibleSectionProps = {
  title: string
  icon: ReactNode
  count?: number
  loading?: boolean
  error?: boolean
  defaultOpen?: boolean
  children: ReactNode
}

function CollapsibleSection({
  title,
  icon,
  count,
  loading = false,
  error = false,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={styles.card}>
      <button
        type="button"
        className={`${styles.cardHeaderToggle} ${open ? styles.cardHeaderOpen : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.cardHeaderLeft}>
          <span className={styles.cardHeaderIcon} aria-hidden>
            {icon}
          </span>
          <span className={styles.cardTitle}>{title}</span>
          {loading && <span className={styles.headerSpinner} aria-label="Loading" />}
          {!loading && !error && typeof count === 'number' && (
            <span className={styles.badge}>{count}</span>
          )}
        </span>
        <ChevronRight
          size={16}
          strokeWidth={2}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          aria-hidden
        />
      </button>
      {open && <div className={styles.cardBody}>{children}</div>}
    </div>
  )
}

function QuotesCard({ accountId, reloadKey }: { accountId: string; reloadKey: number }) {
  const { data, loading, error } = useAccountQuotes(accountId, reloadKey)
  const [query, setQuery] = useState('')
  const visible = filterBySearch(data, query, (r) => [r.name, ...r.productNames])

  return (
    <CollapsibleSection
      title="QUOTES"
      icon={<FileText size={15} strokeWidth={2} />}
      count={data.length}
      loading={loading}
      error={Boolean(error)}
      defaultOpen={false}
    >
      <SectionSearch
        value={query}
        onChange={setQuery}
        placeholder="Search quote or product name"
        matchCount={visible.length}
        total={data.length}
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Account</th>
              <th className={styles.th}>Total Price</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SpinnerRow cols={4} />}
            {!loading && error && <ErrorRow cols={4} message={error} />}
            {!loading && !error && data.length === 0 && <EmptyRow cols={4} />}
            {!loading && !error && data.length > 0 && visible.length === 0 && (
              <EmptyRow cols={4} message={noMatchMessage(query)} />
            )}
            {!loading && !error && visible.map((r: QuoteRecord) => (
              <tr key={r.id}>
                <td className={`${styles.td} ${styles.primaryCell}`}>{r.name}</td>
                <td className={styles.td}><StatusChip status={r.status} /></td>
                <td className={styles.td}>{r.quoteAccountName ?? '—'}</td>
                <td className={`${styles.td} ${styles.numCell}`}>{r.totalPrice !== null ? formatMoney(r.totalPrice) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}

function OrdersCard({ accountId, reloadKey }: { accountId: string; reloadKey: number }) {
  const { data, loading, error } = useAccountOrders(accountId, reloadKey)
  const [query, setQuery] = useState('')
  const visible = filterBySearch(data, query, (r) => [r.orderNumber, ...r.productNames])

  return (
    <CollapsibleSection
      title="ORDERS"
      icon={<ShoppingBag size={15} strokeWidth={2} />}
      count={data.length}
      loading={loading}
      error={Boolean(error)}
      defaultOpen={false}
    >
      <SectionSearch
        value={query}
        onChange={setQuery}
        placeholder="Search order number or product name"
        matchCount={visible.length}
        total={data.length}
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Order #</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Total</th>
              <th className={styles.th}>Effective Date</th>
              <th className={styles.th}>End Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SpinnerRow cols={5} />}
            {!loading && error && <ErrorRow cols={5} message={error} />}
            {!loading && !error && data.length === 0 && <EmptyRow cols={5} />}
            {!loading && !error && data.length > 0 && visible.length === 0 && (
              <EmptyRow cols={5} message={noMatchMessage(query)} />
            )}
            {!loading && !error && visible.map((r: OrderRecord) => (
              <tr key={r.id}>
                <td className={`${styles.td} ${styles.primaryCell}`}>{r.orderNumber}</td>
                <td className={styles.td}><StatusChip status={r.status} /></td>
                <td className={`${styles.td} ${styles.numCell}`}>{formatMoney(r.totalAmount, r.currencyIsoCode)}</td>
                <td className={styles.td}>{formatDate(r.effectiveDate)}</td>
                <td className={styles.td}>{formatDate(r.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}

type AssetsCardProps = {
  accountId: string
  reloadKey: number
  onActionCompleted: () => void
}

function AssetsCard({ accountId, reloadKey, onActionCompleted }: AssetsCardProps) {
  const { orgInfo } = useSalesforceConfig()
  const { data, isMultiCurrency, loading, error } = useAccountAssets(accountId, reloadKey)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [drawer, setDrawer] = useState<{ action: AssetActionDef; assets: AssetRecord[] } | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)

  const selected = useMemo(() => data.filter((r) => selectedIds.has(r.id)), [data, selectedIds])
  const selectedCount = selected.length
  const eligibility = useMemo(
    () =>
      new Map(
        ASSET_ACTIONS.map((action) => [
          action.key,
          selectionEligibility(action, selected, {
            allAssets: data,
            apiVersion: orgInfo.apiVersion,
            isMultiCurrency,
          }),
        ]),
      ),
    [data, selected, orgInfo.apiVersion, isMultiCurrency],
  )
  const visible = filterBySearch(data, query, (r) => [r.name, r.productName])
  const visibleSelectedCount = visible.filter((r) => selectedIds.has(r.id)).length
  const allSelected = visible.length > 0 && visibleSelectedCount === visible.length
  const someSelected = visibleSelectedCount > 0 && !allSelected

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const r of visible) {
        if (allSelected) next.delete(r.id)
        else next.add(r.id)
      }
      return next
    })
  }

  const hasSelection = selectedCount > 0

  const handleActionCompleted = useCallback(() => {
    setSelectedIds(new Set())
    onActionCompleted()
  }, [onActionCompleted])

  return (
    <CollapsibleSection
      title="ASSETS & SUBSCRIPTIONS"
      icon={<Layers size={15} strokeWidth={2} />}
      count={data.length}
      loading={loading}
      error={Boolean(error)}
      defaultOpen={false}
    >
      <SectionSearch
        value={query}
        onChange={setQuery}
        placeholder="Search asset or product name"
        matchCount={visible.length}
        total={data.length}
      />
      <div className={styles.assetToolbar}>
        <div className={styles.selectionInfo}>
          {hasSelection ? (
            <>
              <span className={styles.selectionBadge}>{selectedCount} selected</span>
              <button
                type="button"
                className={styles.clearSelectionBtn}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
            </>
          ) : (
            <span className={styles.selectionHint}>
              Select assets below to manage subscriptions
            </span>
          )}
        </div>
        <div className={styles.assetActions}>
          {ASSET_ACTIONS.map((action) => {
            const { ok, reasons } = eligibility.get(action.key) ?? { ok: false, reasons: [] }
            const Icon = action.icon
            const title = !hasSelection
              ? 'Select assets below'
              : ok
                ? `${action.label} ${selectedCount} selected ${selectedCount === 1 ? 'asset' : 'assets'}`
                : reasons.join('\n')
            return (
              <span key={action.key} className={styles.assetActionWrap} title={title}>
                <button
                  type="button"
                  className={`${styles.assetActionBtn} ${ACTION_VARIANT_CLASS[action.variant]}`}
                  disabled={!ok}
                  onClick={() => setDrawer({ action, assets: selected })}
                >
                  <Icon size={14} strokeWidth={2} aria-hidden />
                  <span>{action.label}</span>
                </button>
              </span>
            )
          })}
        </div>
      </div>

      {drawer && (
        <AssetActionDrawer
          action={drawer.action}
          assets={drawer.assets}
          isMultiCurrency={isMultiCurrency}
          onClose={() => setDrawer(null)}
          onCompleted={handleActionCompleted}
        />
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.selectCol}`}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className={styles.rowCheckbox}
                  aria-label={query.trim() ? 'Select all matching assets' : 'Select all assets'}
                  checked={allSelected}
                  disabled={loading || Boolean(error) || visible.length === 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Product</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Qty</th>
              <th className={styles.th}>Start Date</th>
              <th className={styles.th}>End Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SpinnerRow cols={8} />}
            {!loading && error && <ErrorRow cols={8} message={error} />}
            {!loading && !error && data.length === 0 && <EmptyRow cols={8} />}
            {!loading && !error && data.length > 0 && visible.length === 0 && (
              <EmptyRow cols={8} message={noMatchMessage(query)} />
            )}
            {!loading && !error && visible.map((r: AssetRecord) => {
              const isSelected = selectedIds.has(r.id)
              const isExpanded = expandedIds.has(r.id)
              const actionCount = r.actions.length
              return (
                <Fragment key={r.id}>
                  <tr
                    className={`${styles.selectableRow} ${isSelected ? styles.rowSelected : ''}`}
                    onClick={() => toggleSelected(r.id)}
                  >
                    <td
                      className={`${styles.td} ${styles.selectCell}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className={styles.rowCheckbox}
                        aria-label={`Select ${r.name}`}
                        checked={isSelected}
                        onChange={() => toggleSelected(r.id)}
                      />
                    </td>
                    <td className={`${styles.td} ${styles.primaryCell}`}>
                      <span className={styles.nameCell}>
                        <button
                          type="button"
                          className={styles.expandBtn}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Hide' : 'Show'} asset actions for ${r.name}`}
                          title={
                            actionCount === 0
                              ? 'No asset actions'
                              : `${isExpanded ? 'Hide' : 'Show'} ${actionCount} asset ${actionCount === 1 ? 'action' : 'actions'}`
                          }
                          disabled={actionCount === 0}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded(r.id)
                          }}
                        >
                          <ChevronRight
                            size={14}
                            strokeWidth={2}
                            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                            aria-hidden
                          />
                        </button>
                        {r.name}
                      </span>
                    </td>
                    <td className={styles.td}>{r.productName ?? '—'}</td>
                    <td className={styles.td}>
                      {r.sellingModelType ? (
                        <StatusChip
                          status={`${sellingModelLabel(r.sellingModelType)}${r.usageModelType ? ' · Usage' : ''}`}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={styles.td}><StatusChip status={r.status} /></td>
                    <td className={`${styles.td} ${styles.numCell}`}>{r.quantity ?? '—'}</td>
                    <td className={styles.td}>{formatDate(r.startDate)}</td>
                    <td className={styles.td}>{formatDate(r.endDate)}</td>
                  </tr>
                  {isExpanded && (
                    <tr className={styles.assetActionsRow}>
                      <td colSpan={8} className={styles.assetActionsCell}>
                        <div className={styles.assetActionsWrap}>
                          <table className={styles.assetActionsTable}>
                            <thead>
                              <tr>
                                <th className={styles.th}>Action Date</th>
                                <th className={styles.th}>Business Category</th>
                                <th className={styles.th}>Change in Quantity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.actions.map((a) => (
                                <tr key={a.id}>
                                  <td className={styles.td}>{formatDate(a.actionDate)}</td>
                                  <td className={styles.td}>{a.category ?? '—'}</td>
                                  <td className={`${styles.td} ${styles.numCell}`}>
                                    {formatSignedNumber(a.quantityChange)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}

function InvoicesCard({ accountId }: { accountId: string }) {
  const { data, loading, error } = useAccountInvoices(accountId)
  const [query, setQuery] = useState('')
  const visible = filterBySearch(data, query, (r) => [r.invoiceNumber, ...r.productNames])

  return (
    <CollapsibleSection
      title="INVOICES"
      icon={<Receipt size={15} strokeWidth={2} />}
      count={data.length}
      loading={loading}
      error={Boolean(error)}
      defaultOpen={false}
    >
      <SectionSearch
        value={query}
        onChange={setQuery}
        placeholder="Search invoice number or product name"
        matchCount={visible.length}
        total={data.length}
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Invoice #</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Total</th>
              <th className={styles.th}>Total w/ Tax</th>
              <th className={styles.th}>Balance</th>
              <th className={styles.th}>Invoice Date</th>
              <th className={styles.th}>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SpinnerRow cols={7} />}
            {!loading && error && <ErrorRow cols={7} message={error} />}
            {!loading && !error && data.length === 0 && <EmptyRow cols={7} />}
            {!loading && !error && data.length > 0 && visible.length === 0 && (
              <EmptyRow cols={7} message={noMatchMessage(query)} />
            )}
            {!loading && !error && visible.map((r: InvoiceRecord) => (
              <tr key={r.id}>
                <td className={`${styles.td} ${styles.primaryCell}`}>{r.invoiceNumber}</td>
                <td className={styles.td}><StatusChip status={r.status} /></td>
                <td className={`${styles.td} ${styles.numCell}`}>{formatMoney(r.totalAmount)}</td>
                <td className={`${styles.td} ${styles.numCell}`}>{formatMoney(r.totalWithTax)}</td>
                <td className={`${styles.td} ${styles.numCell}`}>{formatMoney(r.balance)}</td>
                <td className={styles.td}>{formatDate(r.invoiceDate)}</td>
                <td className={styles.td}>{formatDate(r.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}

export function DashboardPage() {
  const account = useMemo(() => loadActiveAccount(), [])
  const [reloadKey, setReloadKey] = useState(0)
  const handleAssetActionCompleted = useCallback(() => setReloadKey((k) => k + 1), [])

  if (!account?.accountId) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.warnCard}>
          <p className={styles.warnText}>
            No active account selected. Go to{' '}
            <Link to="/admin/salesforce" className={styles.link}>
              Admin → Salesforce
            </Link>{' '}
            to set an account before viewing dashboard data.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Dashboard</h1>

      <div className={`${styles.card} ${styles.accountCard}`}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>ACTIVE ACCOUNT</span>
          <Link to="/admin/salesforce" className={styles.link}>
            Change
          </Link>
        </div>
        <p className={styles.accountName}>{account.accountName || '—'}</p>
        <p className={styles.accountId}>{account.accountId}</p>
      </div>

      <AssetsCard
        accountId={account.accountId}
        reloadKey={reloadKey}
        onActionCompleted={handleAssetActionCompleted}
      />
      <QuotesCard accountId={account.accountId} reloadKey={reloadKey} />
      <OrdersCard accountId={account.accountId} reloadKey={reloadKey} />
      <InvoicesCard accountId={account.accountId} />
    </div>
  )
}
