import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuoteCart, type QuoteItem } from '../../quote/QuoteCartContext'
import { usePlaceSalesTransaction } from '../../quote/usePlaceSalesTransaction'
import styles from './QuoteCartModal.module.css'

function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function QuoteCartModal() {
  const { items, removeItem, clearCart, isModalOpen, closeModal } = useQuoteCart()
  const { submit, state, reset } = usePlaceSalesTransaction()
  const navigate = useNavigate()

  // Auto-close on success after 3s
  useEffect(() => {
    if (state.status !== 'success') return
    const t = setTimeout(closeModal, 3000)
    return () => clearTimeout(t)
  }, [state.status, closeModal])

  // Reset PST state when modal closes
  useEffect(() => {
    if (!isModalOpen) reset()
  }, [isModalOpen, reset])

  if (!isModalOpen) return null

  const grandTotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const currency = items[0]?.currencyIsoCode ?? 'USD'
  const isSubmitting = state.status === 'loading'

  function handleViewFullQuote() {
    closeModal()
    navigate('/quotes')
  }

  return (
    <>
      <div className={styles.backdrop} onClick={closeModal} aria-hidden />
      <div className={styles.drawer} role="dialog" aria-modal aria-label="Quote Cart">
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>
            Quote Cart
            {items.length > 0 && (
              <span className={styles.badge}>{items.length}</span>
            )}
          </span>
          <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.drawerBody}>
          {items.length === 0 ? (
            <p className={styles.emptyState}>No items in your quote yet.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Product</th>
                  <th className={styles.th}>Model</th>
                  <th className={styles.th}>Qty</th>
                  <th className={styles.th}>Unit</th>
                  <th className={styles.th}>Total</th>
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
          )}
        </div>

        {items.length > 0 && (
          <div className={styles.drawerFooter}>
            {state.status === 'error' && (
              <div className={styles.errorBanner} role="alert">
                {state.error}
              </div>
            )}
            {state.status === 'success' && (
              <div className={styles.successBanner} role="status">
                Quote created successfully
                {state.quoteId && (
                  <span className={styles.quoteId}> — ID: {state.quoteId}</span>
                )}
                <br />
                <span className={styles.successHint}>Closing in a moment…</span>
              </div>
            )}
            <div className={styles.totalRow}>
              <span>Estimated Total</span>
              <span className={styles.totalAmount}>{formatMoney(grandTotal, currency)}</span>
            </div>
            <button
              type="button"
              className={styles.requestBtn}
              onClick={() => submit(items)}
              disabled={isSubmitting || state.status === 'success'}
            >
              {isSubmitting ? 'Submitting…' : 'Request Quote'}
            </button>
            <div className={styles.footerActions}>
              <button type="button" className={styles.viewLink} onClick={handleViewFullQuote}>
                View Full Quote →
              </button>
              <button
                type="button"
                className={styles.clearBtn}
                onClick={clearCart}
                disabled={isSubmitting}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
