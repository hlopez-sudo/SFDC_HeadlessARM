import { Link } from 'react-router-dom'
import { useOrderCart, type OrderCartItem } from '../quote/OrderCartContext'
import { usePlaceOrder } from '../quote/usePlaceOrder'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import type { LifecycleStep } from '../quote/useBuyNow'
import styles from './CartPage.module.css'

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

export function CartPage() {
  const { items, removeItem, clearCart } = useOrderCart()
  const { submit, state, reset } = usePlaceOrder()
  const { orgInfo } = useSalesforceConfig()

  const grandTotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const currency = items[0]?.currencyIsoCode ?? 'USD'
  const isSubmitting = state.status === 'loading'

  if (items.length === 0 && state.status !== 'success') {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Cart</h1>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Your cart is empty.</p>
          <Link to="/" className={styles.browseLink}>Browse products to add items →</Link>
        </div>
      </div>
    )
  }

  if (state.status === 'success') {
    const sfUrl = state.orderId && orgInfo.instanceUrl
      ? `${orgInfo.instanceUrl}/${state.orderId}`
      : null

    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Cart</h1>
        <div className={styles.successCard}>
          <p className={styles.successHeading}>Order activated successfully</p>

          {state.orderId && (
            <div className={styles.orderIdRow}>
              <span className={styles.successLabel}>Order ID</span>
              <span className={styles.orderIdValue}>{state.orderId}</span>
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

          {state.lifecycleSteps.length > 0 && (
            <ul className={styles.stepList}>
              {state.lifecycleSteps.map((step, i) => (
                <li key={i} className={stepItemClass(step.status)}>
                  <StepIcon step={step} />
                  <span className={styles.stepName}>{step.name}</span>
                </li>
              ))}
            </ul>
          )}

          {state.apiResponse !== null && (
            <details className={styles.requestDetails}>
              <summary className={styles.requestSummary}>API Response</summary>
              <pre className={styles.responseJson}>
                {JSON.stringify(state.apiResponse, null, 2)}
              </pre>
            </details>
          )}

          <button
            type="button"
            className={styles.newOrderBtn}
            onClick={() => { clearCart(); reset() }}
          >
            Start New Order
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Cart</h1>
        <span className={styles.itemCount}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
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
      </div>

      {state.status === 'error' && (
        <div className={styles.errorCard} role="alert">
          {state.error}
        </div>
      )}

      {state.lifecycleSteps.length > 0 && (
        <div className={styles.stepsCard}>
          <p className={styles.stepsHeading}>Order Lifecycle</p>
          <ul className={styles.stepList}>
            {state.lifecycleSteps.map((step, i) => (
              <li key={i} className={stepItemClass(step.status)}>
                <StepIcon step={step} />
                <span className={styles.stepName}>{step.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isSubmitting && state.loadingStep && (
        <p className={styles.loadingNote}>{state.loadingStep}</p>
      )}

      <div className={styles.footer}>
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>Estimated Total</span>
          <span className={styles.totalAmount}>{formatMoney(grandTotal, currency)}</span>
        </div>
        <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={() => submit(items)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting…' : 'Submit Order'}
          </button>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={clearCart}
            disabled={isSubmitting}
          >
            Clear Cart
          </button>
        </div>
      </div>
    </div>
  )
}
