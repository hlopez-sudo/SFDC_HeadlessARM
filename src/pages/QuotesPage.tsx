import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuoteCart, type QuoteItem } from '../quote/QuoteCartContext'
import { usePlaceSalesTransaction } from '../quote/usePlaceSalesTransaction'
import styles from './QuotesPage.module.css'

function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function QuotesPage() {
  const { items, removeItem, clearCart } = useQuoteCart()
  const { submit, state, reset } = usePlaceSalesTransaction()
  const [quoteName, setQuoteName] = useState('')

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
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Quote</h1>
        <div className={styles.successCard}>
          <p className={styles.successHeading}>Quote submitted successfully</p>
          {state.quoteId && (
            <p className={styles.successId}>
              Salesforce Quote ID: <span className={styles.quoteIdValue}>{state.quoteId}</span>
            </p>
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
