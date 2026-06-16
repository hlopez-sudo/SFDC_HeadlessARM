import { useEffect, useRef } from 'react'
import { useSalesforceConfig } from '../../salesforce/SalesforceConfigContext'
import { useBuyNow, type LifecycleStep } from '../../quote/useBuyNow'
import { useBuyNowDrawer } from '../../quote/BuyNowDrawerContext'
import styles from './TrialDrawer.module.css'

function formatMoney(amount: number, currencyIsoCode: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyIsoCode || 'USD',
  }).format(amount)
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

export function BuyNowDrawer() {
  const { isOpen, params, closeBuyNow } = useBuyNowDrawer()
  const { orgInfo } = useSalesforceConfig()
  const { submit, state, reset } = useBuyNow()
  const lastProductId = useRef<string | null>(null)

  // Reset submission state when the drawer is opened for a different product
  useEffect(() => {
    if (!isOpen || !params) return
    if (lastProductId.current !== null && lastProductId.current !== params.productId) {
      reset()
    }
    lastProductId.current = params.productId
  }, [isOpen, params, reset])

  // Never mounted before any order was requested
  if (!params) return null

  const isLoading = state.status === 'loading'
  const isSuccess = state.status === 'success'
  const isIdle = state.status === 'idle'

  const total = params.unitPrice * params.quantity

  const sfOrderUrl =
    state.orderId && orgInfo.instanceUrl
      ? `${orgInfo.instanceUrl}/${state.orderId}`
      : null

  const spinnerLabel = state.loadingStep ?? 'Creating Order…'

  function handleConfirm() {
    if (!params) return
    submit(params.productId, params.sellingModel, params.quantity, params.sellingModelId)
  }

  return (
    <>
      {isOpen && <div className={styles.backdrop} onClick={closeBuyNow} aria-hidden />}

      <div
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : styles.drawerClosed}`}
        role="dialog"
        aria-modal
        aria-label="Order Summary"
        aria-hidden={!isOpen}
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>
            Order Summary
            <span className={styles.trialBadge}>Direct Order</span>
          </span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeBuyNow}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.drawerBody}>
          {/* Success banner */}
          {isSuccess && (
            <div className={styles.successBanner} role="status">
              <strong>Order activated successfully!</strong>
              {state.orderId && (
                <>
                  <span>
                    Order ID: <span className={styles.orderId}>{state.orderId}</span>
                  </span>
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
                </>
              )}
              <button type="button" className={styles.resetBtn} onClick={reset}>
                Place another order
              </button>
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

          {/* Summary table */}
          <table className={styles.summaryTable}>
            <tbody>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Product</td>
                <td className={styles.rowValue}>{params.productName}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Selling Model</td>
                <td className={styles.rowValue}>{params.sellingModel || '—'}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Quantity</td>
                <td className={styles.rowValue}>{params.quantity}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Unit Price</td>
                <td className={styles.rowValue}>{formatMoney(params.unitPrice, params.currencyIsoCode)}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Total</td>
                <td className={styles.rowValue}>{formatMoney(total, params.currencyIsoCode)}</td>
              </tr>
              {params.accountName && (
                <tr className={styles.summaryRow}>
                  <td className={styles.rowLabel}>Account</td>
                  <td className={styles.rowValue}>{params.accountName}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Action buttons — only before submission */}
          {isIdle && (
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={closeBuyNow}>
                Cancel
              </button>
              <button type="button" className={styles.confirmBtn} onClick={handleConfirm}>
                Confirm Purchase
              </button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className={styles.actions}>
              <button type="button" className={styles.confirmBtn} disabled>
                <span className={styles.spinner} aria-hidden />
                {spinnerLabel}
              </button>
            </div>
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
        </div>
      </div>
    </>
  )
}
