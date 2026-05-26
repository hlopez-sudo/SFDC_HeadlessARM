import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuoteCart, type QuoteItem } from '../quote/QuoteCartContext'
import { usePlaceSalesTransaction } from '../quote/usePlaceSalesTransaction'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import styles from './QuotesPage.module.css'

function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function derivePreviewSellingModelFields(name: string): Record<string, string> {
  const lower = name.toLowerCase()
  if (lower.includes('one time') || lower.includes('onetime')) {
    return { SellingModelType: 'OneTime' }
  }
  const fields: Record<string, string> = {}
  if (lower.includes('term')) fields.SellingModelType = 'TermDefined'
  // if (lower.includes('monthly')) {
  //   fields.BillingFrequency = 'Monthly'
  //   fields.PricingTermUnit = 'Months'
  //   fields.SubscriptionTermUnit = 'Months'
  // } else if (lower.includes('annual')) {
  //   fields.BillingFrequency = 'Annual'
  //   fields.PricingTermUnit = 'Annual'
  //   fields.SubscriptionTermUnit = 'Annual'
  // }
  return fields
}

export function QuotesPage() {
  const { items, removeItem, clearCart } = useQuoteCart()
  const { submit, state, reset } = usePlaceSalesTransaction()
  const { orgInfo } = useSalesforceConfig()
  const [quoteName, setQuoteName] = useState('')
  const [requestOpen, setRequestOpen] = useState(false)

  const activeAccountId = useMemo(() => {
    try {
      const raw = localStorage.getItem('fc-active-account')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { accountId?: string }
      return parsed?.accountId ?? null
    } catch { return null }
  }, [])

  const grandTotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const currency = items[0]?.currencyIsoCode ?? 'USD'
  const isSubmitting = state.status === 'loading'

  if (items.length === 0 && state.status !== 'success') {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Quote</h1>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Your quote is empty.</p>
          <Link to="/" className={styles.browseLink}>Browse products to add items →</Link>
        </div>
      </div>
    )
  }

  if (state.status === 'success') {
    const salesTransactionId =
      state.apiResponse &&
      typeof state.apiResponse === 'object' &&
      'salesTransactionId' in (state.apiResponse as Record<string, unknown>)
        ? (state.apiResponse as Record<string, unknown>).salesTransactionId as string
        : null
    const sfUrl = salesTransactionId && orgInfo.instanceUrl
      ? `${orgInfo.instanceUrl}/${salesTransactionId}`
      : null

    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Quote</h1>
        <div className={styles.successCard}>
          <p className={styles.successHeading}>Quote submitted successfully</p>

          {state.quoteId && (
            <div className={styles.quoteIdRow}>
              <span className={styles.successLabel}>Quote ID</span>
              <span className={styles.quoteIdValue}>{state.quoteId}</span>
            </div>
          )}

          {sfUrl && (
            <a
              href={sfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sfButton}
            >
              View in Salesforce ↗
            </a>
          )}

          {state.apiResponse !== null && (
            <details className={styles.responseDetails}>
              <summary className={styles.responseSummary}>API Response</summary>
              <pre className={styles.responseJson}>
                {JSON.stringify(state.apiResponse, null, 2)}
              </pre>
            </details>
          )}

          <button
            type="button"
            className={styles.newQuoteBtn}
            onClick={() => { clearCart(); reset() }}
          >
            Start New Quote
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Quote</h1>
        <span className={styles.itemCount}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.nameField}>
        <label className={styles.nameLabel} htmlFor="quote-name">Quote Name</label>
        <input
          id="quote-name"
          type="text"
          className={styles.nameInput}
          value={quoteName}
          onChange={(e) => setQuoteName(e.target.value)}
          placeholder="Auto-generated if left blank"
          disabled={isSubmitting}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Product</th>
              <th className={styles.th}>Selling Model</th>
              <th className={styles.th}>Qty</th>
              <th className={styles.th}>Unit Price</th>
              <th className={styles.th}>Line Total</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: QuoteItem) => (
              <tr key={item.id}>
                <td className={styles.td}>{item.productName}</td>
                <td className={styles.td}>{item.sellingModel || '—'}</td>
                <td className={styles.td}>{item.quantity}</td>
                <td className={styles.td}>
                  {item.unitPrice > 0 ? formatMoney(item.unitPrice, item.currencyIsoCode) : '—'}
                </td>
                <td className={styles.td}>
                  {item.lineTotal > 0 ? formatMoney(item.lineTotal, item.currencyIsoCode) : '—'}
                </td>
                <td className={styles.td}>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.productName}`}
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.status === 'error' && (
        <div className={styles.errorCard} role="alert">
          {state.error}
        </div>
      )}

      <details
        className={styles.requestDetails}
        open={requestOpen}
        onToggle={(e) => setRequestOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className={styles.requestSummary}>
          {requestOpen ? '▾' : '▸'} Request Preview
        </summary>
        <div className={styles.requestBody}>
          <p className={styles.requestEndpoint}>
            <span className={styles.requestMethod}>POST</span>
            {` /api/salesforce/services/data/v${orgInfo.apiVersion || '62.0'}/connect/rev/sales-transaction/actions/place`}
          </p>
          <pre className={styles.requestJson}>
            {JSON.stringify({
              pricingPref: 'Force',
              taxPref: 'Skip',
              graph: {
                graphId: 'createQuote',
                records: [
                  {
                    referenceId: 'refQuote',
                    record: {
                      attributes: { type: 'Quote', method: 'POST' },
                      Name: quoteName.trim() || '(auto-generated)',
                      ...(activeAccountId ? { QuoteAccountId: activeAccountId } : {}),
                    },
                  },
                  ...items.map((item, i) => {
                    const smFields = item.sellingModel ? derivePreviewSellingModelFields(item.sellingModel) : {}
                    return {
                      referenceId: `refQuoteLine${i}`,
                      record: {
                        attributes: { type: 'QuoteLineItem', method: 'POST' },
                        QuoteId: '@{refQuote.id}',
                        Product2Id: item.productId,
                        PricebookEntryId: '(looked up from Pricebook)',
                        ...smFields,
                        Quantity: item.quantity,
                        StartDate: '(from config)',
                        EndDate: '(from config)',
                        PeriodBoundary: 'Anniversary',
                      },
                    }
                  }),
                ],
              },
            }, null, 2)}
          </pre>
        </div>
      </details>

      <div className={styles.footer}>
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>Estimated Total</span>
          <span className={styles.totalAmount}>{formatMoney(grandTotal, currency)}</span>
        </div>
        <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.requestBtn}
            onClick={() => submit(items, quoteName)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting…' : 'Request Quote'}
          </button>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={clearCart}
            disabled={isSubmitting}
          >
            Clear Quote
          </button>
        </div>
      </div>
    </div>
  )
}
