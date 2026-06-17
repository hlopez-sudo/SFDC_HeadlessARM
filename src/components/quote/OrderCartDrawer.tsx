import { useNavigate } from 'react-router-dom'
import { useOrderCart, type OrderCartItem } from '../../quote/OrderCartContext'
import { usePlaceOrder } from '../../quote/usePlaceOrder'
import { useSalesforceConfig } from '../../salesforce/SalesforceConfigContext'
import type { LifecycleStep } from '../../quote/useBuyNow'
import styles from './OrderCartDrawer.module.css'

function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function StepIcon({ step }: { step: LifecycleStep }) {
  if (step.status === 'running') return <span className={styles.stepIcon} aria-hidden />
  if (step.status === 'done') return <span className={styles.stepIcon}>✓</span>
  if (step.status === 'error') return <span className={styles.stepIcon}>✗</span>
  return <span className={styles.stepIcon}>·</span>
}

function stepItemClass(status: LifecycleStep['status']): string {
  if (status === 'done') return `${styles.stepItem} ${styles.stepDone}`
  if (status === 'error') return `${styles.stepItem} ${styles.stepError}`
  if (status === 'running') return `${styles.stepItem} ${styles.stepRunning}`
  return styles.stepItem
}

export function OrderCartDrawer() {
  const { items, clearCart, removeItem, isOpen, closeDrawer } = useOrderCart()
  const { submit, state, reset } = usePlaceOrder()
  const { orgInfo } = useSalesforceConfig()
  const navigate = useNavigate()

  const grandTotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const currency = items[0]?.currencyIsoCode ?? 'USD'
  const isSubmitting = state.status === 'loading'
  const isSuccess = state.status === 'success'

  const sfOrderUrl =
    state.orderId && orgInfo.instanceUrl
      ? `${orgInfo.instanceUrl}/${state.orderId}`
      : null

  const spinnerLabel = state.loadingStep ?? 'Submitting…'

  function handleViewFullCart() {
    closeDrawer()
    navigate('/cart')
  }

  function handleNewOrder() {
    clearCart()
    reset()
    closeDrawer()
  }

  return (
    <>
      {isOpen && <div className={styles.backdrop} onClick={closeDrawer} aria-hidden />}

      <div
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : styles.drawerClosed}`}
        role="dialog"
        aria-modal
        aria-label="Order Cart"
        aria-hidden={!isOpen}
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>
            Order Cart
            <span className={styles.orderBadge}>Order</span>
            {items.length > 0 && !isSuccess && (
              <span className={styles.badge}>{items.length}</span>
            )}
          </span>
          <button type="button" className={styles.closeBtn} onClick={closeDrawer} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.drawerBody}>
          {/* Success banner */}
          {isSuccess && (
            <div className={styles.successBanner} role="status">
              <strong>Order activated successfully!</strong>
              {state.orderId && (
                <span>
                  Order ID: <span className={styles.orderId}>{state.orderId}</span>
                </span>
              )}
              {sfOrderUrl && (
                <a
                  href={sfOrderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.sfLink}
                >
                  View in Salesforce →
                </a>
              )}
            </div>
          )}

          {/* Error banner */}
          {state.status === 'error' && state.error && (
            <div className={styles.errorBanner} role="alert">
              <div><strong>Error:</strong> {state.error}</div>
              <button type="button" className={styles.resetBtn} onClick={reset}>
                Try again
              </button>
            </div>
          )}

          {/* Line items */}
          {items.length === 0 && !isSuccess ? (
            <p className={styles.emptyState}>No items in your cart yet.</p>
          ) : (
            !isSuccess && (
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
                  {items.map((item: OrderCartItem) => (
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
            )
          )}

          {/* Total + submit — only before success */}
          {items.length > 0 && !isSuccess && (
            <>
              <div className={styles.totalRow}>
                <span>Estimated Total</span>
                <span className={styles.totalAmount}>{formatMoney(grandTotal, currency)}</span>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={() => submit(items)}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <span className={styles.spinner} aria-hidden />}
                  {isSubmitting ? spinnerLabel : 'Submit Order'}
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
            </>
          )}

          {/* PST request collapsibles */}
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
              <summary className={styles.detailsSummary}>PST Response</summary>
              <pre className={styles.codeBlock}>
                {JSON.stringify(state.apiResponse, null, 2)}
              </pre>
            </details>
          )}

          {/* Activation lifecycle steps */}
          {state.lifecycleSteps.length > 0 && (
            <div>
              <ul className={styles.stepList}>
                {state.lifecycleSteps.map((step, i) => (
                  <li key={i} className={stepItemClass(step.status)}>
                    <StepIcon step={step} />
                    <span className={styles.stepName}>{step.name}</span>
                  </li>
                ))}
              </ul>

              {/* Per-step collapsibles for method/URL + response */}
              {state.lifecycleSteps.map((step, i) =>
                step.url || step.response || step.error ? (
                  <details key={i} className={styles.detailsBlock}>
                    <summary className={styles.detailsSummary}>{step.name}</summary>
                    {step.url && (
                      <div className={styles.detailsContent}>
                        <p className={styles.endpointLine}>
                          <span className={styles.methodBadge}>{step.method ?? 'POST'}</span>
                          {step.url}
                        </p>
                      </div>
                    )}
                    {step.requestBody !== undefined && (
                      <pre className={styles.codeBlock}>
                        {'Request: ' + JSON.stringify(step.requestBody, null, 2)}
                      </pre>
                    )}
                    {(step.response !== undefined || step.error) && (
                      <pre className={styles.codeBlock}>
                        {step.error
                          ? `Error: ${step.error}`
                          : 'Response: ' + JSON.stringify(step.response, null, 2)}
                      </pre>
                    )}
                  </details>
                ) : null
              )}
            </div>
          )}

          {/* Footer actions */}
          {(items.length > 0 || isSuccess) && (
            <div className={styles.footerActions}>
              <button type="button" className={styles.viewLink} onClick={handleViewFullCart}>
                View Full Cart →
              </button>
              {isSuccess && (
                <button type="button" className={styles.newOrderBtn} onClick={handleNewOrder}>
                  New Order
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
