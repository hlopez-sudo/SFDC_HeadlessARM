import { useNavigate } from 'react-router-dom'
import { useQuoteCart, type QuoteItem } from '../../quote/QuoteCartContext'
import { usePlaceSalesTransaction } from '../../quote/usePlaceSalesTransaction'
import { useSalesforceConfig } from '../../salesforce/SalesforceConfigContext'
import styles from './QuoteCartModal.module.css'

function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function QuoteCartModal() {
  const { items, clearCart, removeItem, isModalOpen, closeModal } = useQuoteCart()
  const { submit, state, reset } = usePlaceSalesTransaction()
  const { orgInfo } = useSalesforceConfig()
  const navigate = useNavigate()

  if (!isModalOpen) return null

  const grandTotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const currency = items[0]?.currencyIsoCode ?? 'USD'
  const isSubmitting = state.status === 'loading'
  const isSuccess = state.status === 'success'

  const sfQuoteUrl =
    state.quoteId && orgInfo.instanceUrl
      ? `${orgInfo.instanceUrl}/${state.quoteId}`
      : null

  function handleViewFullQuote() {
    closeModal()
    navigate('/quotes')
  }

  function handleNewQuote() {
    clearCart()
    reset()
    closeModal()
  }

  return (
    <>
      <div className={styles.backdrop} onClick={closeModal} aria-hidden />
      <div className={styles.drawer} role="dialog" aria-modal aria-label="Quote Cart">
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>
            Quote Cart
            {items.length > 0 && !isSuccess && (
              <span className={styles.badge}>{items.length}</span>
            )}
          </span>
          <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.drawerBody}>
          {items.length === 0 && !isSuccess ? (
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
                  {!isSuccess && <th className={styles.th}></th>}
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
                    {!isSuccess && (
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
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* API detail collapsibles — shown after submission */}
          {(state.requestUrl || state.requestBody !== null || state.apiResponse !== null) && (
            <div className={styles.apiDetails}>
              {state.requestUrl && (
                <details className={styles.detailsBlock}>
                  <summary className={styles.detailsSummary}>Endpoint</summary>
                  <div className={styles.detailsContent}>
                    <p className={styles.endpointLine}>
                      <span className={styles.methodBadge}>POST</span>
                      {state.requestUrl}
                    </p>
                  </div>
                </details>
              )}

              {state.requestBody !== null && (
                <details className={styles.detailsBlock}>
                  <summary className={styles.detailsSummary}>Request Body</summary>
                  <pre className={styles.codeBlock}>
                    {JSON.stringify(state.requestBody, null, 2)}
                  </pre>
                </details>
              )}

              {state.apiResponse !== null && (
                <details className={styles.detailsBlock}>
                  <summary className={styles.detailsSummary}>Response</summary>
                  <pre className={styles.codeBlock}>
                    {JSON.stringify(state.apiResponse, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        {(items.length > 0 || isSuccess) && (
          <div className={styles.drawerFooter}>
            {state.status === 'error' && (
              <div className={styles.errorBanner} role="alert">
                {state.error}
              </div>
            )}

            {isSuccess && (
              <div className={styles.successBanner} role="status">
                <strong>Quote created successfully</strong>
                {state.quoteId && (
                  <span className={styles.quoteId}> — ID: {state.quoteId}</span>
                )}
                {sfQuoteUrl && (
                  <div>
                    <a
                      href={sfQuoteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.sfLink}
                    >
                      View in Salesforce →
                    </a>
                  </div>
                )}
              </div>
            )}

            {!isSuccess && (
              <div className={styles.totalRow}>
                <span>Estimated Total</span>
                <span className={styles.totalAmount}>{formatMoney(grandTotal, currency)}</span>
              </div>
            )}

            {!isSuccess && (
              <button
                type="button"
                className={styles.requestBtn}
                onClick={() => submit(items)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting…' : 'Request Quote'}
              </button>
            )}

            <div className={styles.footerActions}>
              <button type="button" className={styles.viewLink} onClick={handleViewFullQuote}>
                View Full Quote →
              </button>
              {isSuccess ? (
                <button type="button" className={styles.newQuoteBtn} onClick={handleNewQuote}>
                  New Quote
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={clearCart}
                  disabled={isSubmitting}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
