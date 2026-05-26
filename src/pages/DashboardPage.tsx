import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAccountQuotes, type QuoteRecord } from '../hooks/useAccountQuotes'
import { useAccountOrders, type OrderRecord } from '../hooks/useAccountOrders'
import { useAccountAssets, type AssetRecord } from '../hooks/useAccountAssets'
import { useAccountInvoices, type InvoiceRecord } from '../hooks/useAccountInvoices'
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

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMoney(amount: number, currency?: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount)
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

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className={styles.emptyRow}>
        No records found.
      </td>
    </tr>
  )
}

function QuotesCard({ accountId }: { accountId: string }) {
  const { data, loading, error } = useAccountQuotes(accountId)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>QUOTES</span>
        {!loading && !error && <span className={styles.badge}>{data.length}</span>}
      </div>
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
            {!loading && !error && data.map((r: QuoteRecord) => (
              <tr key={r.id}>
                <td className={styles.td}>{r.name}</td>
                <td className={styles.td}><StatusChip status={r.status} /></td>
                <td className={styles.td}>{r.quoteAccountName ?? '—'}</td>
                <td className={styles.td}>{r.totalPrice !== null ? formatMoney(r.totalPrice) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OrdersCard({ accountId }: { accountId: string }) {
  const { data, loading, error } = useAccountOrders(accountId)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>ORDERS</span>
        {!loading && !error && <span className={styles.badge}>{data.length}</span>}
      </div>
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
            {!loading && !error && data.map((r: OrderRecord) => (
              <tr key={r.id}>
                <td className={styles.td}>{r.orderNumber}</td>
                <td className={styles.td}><StatusChip status={r.status} /></td>
                <td className={styles.td}>{formatMoney(r.totalAmount, r.currencyIsoCode)}</td>
                <td className={styles.td}>{formatDate(r.effectiveDate)}</td>
                <td className={styles.td}>{formatDate(r.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AssetsCard({ accountId }: { accountId: string }) {
  const { data, loading, error } = useAccountAssets(accountId)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>ASSETS</span>
        {!loading && !error && <span className={styles.badge}>{data.length}</span>}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Product</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Qty</th>
              <th className={styles.th}>Start Date</th>
              <th className={styles.th}>End Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SpinnerRow cols={6} />}
            {!loading && error && <ErrorRow cols={6} message={error} />}
            {!loading && !error && data.length === 0 && <EmptyRow cols={6} />}
            {!loading && !error && data.map((r: AssetRecord) => (
              <tr key={r.id}>
                <td className={styles.td}>{r.name}</td>
                <td className={styles.td}>{r.productName ?? '—'}</td>
                <td className={styles.td}><StatusChip status={r.status} /></td>
                <td className={styles.td}>{r.quantity ?? '—'}</td>
                <td className={styles.td}>{formatDate(r.startDate)}</td>
                <td className={styles.td}>{formatDate(r.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InvoicesCard({ accountId }: { accountId: string }) {
  const { data, loading, error } = useAccountInvoices(accountId)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>INVOICES</span>
        {!loading && !error && <span className={styles.badge}>{data.length}</span>}
      </div>
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
            {!loading && !error && data.map((r: InvoiceRecord) => (
              <tr key={r.id}>
                <td className={styles.td}>{r.invoiceNumber}</td>
                <td className={styles.td}><StatusChip status={r.status} /></td>
                <td className={styles.td}>{formatMoney(r.totalAmount)}</td>
                <td className={styles.td}>{formatMoney(r.totalWithTax)}</td>
                <td className={styles.td}>{formatMoney(r.balance)}</td>
                <td className={styles.td}>{formatDate(r.invoiceDate)}</td>
                <td className={styles.td}>{formatDate(r.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const account = useMemo(() => loadActiveAccount(), [])

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

      <QuotesCard accountId={account.accountId} />
      <OrdersCard accountId={account.accountId} />
      <AssetsCard accountId={account.accountId} />
      <InvoicesCard accountId={account.accountId} />
    </div>
  )
}
