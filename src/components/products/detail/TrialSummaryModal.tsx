import { useEffect } from 'react'
import { useSalesforceConfig } from '../../../salesforce/SalesforceConfigContext'
import { useStartTrial, type LifecycleStep } from '../../../quote/useStartTrial'
import styles from './TrialSummaryModal.module.css'

interface TrialSummaryModalProps {
  productId: string
  productName: string
  sellingModel: string
  quantity: number
  accountName: string | null
  onClose: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function StepIcon({ step }: { step: LifecycleStep }) {
  if (step.status === 'running') {
    return <span className={styles.stepIcon} aria-hidden />
  }
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

export function TrialSummaryModal({
  productId,
  productName,
  sellingModel,
  quantity,
  accountName,
  onClose,
}: TrialSummaryModalProps) {
  const { orgInfo } = useSalesforceConfig()
  const { submit, state, reset } = useStartTrial()

  const today = new Date()
  const startDate = today.toISOString().split('T')[0]
  const endDateObj = new Date(today)
  endDateObj.setDate(endDateObj.getDate() + 13)
  const endDate = endDateObj.toISOString().split('T')[0]

  const isLoading = state.status === 'loading'
  const isSuccess = state.status === 'success'

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isLoading) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isLoading, onClose])

  useEffect(() => () => reset(), [reset])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !isLoading) onClose()
  }

  function handleConfirm() {
    submit(productId, sellingModel, quantity)
  }

  const sfOrderUrl =
    state.orderId && orgInfo.instanceUrl
      ? `${orgInfo.instanceUrl}/${state.orderId}`
      : null

  const spinnerLabel = state.loadingStep ?? 'Creating Trial…'

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal
        aria-labelledby="trial-modal-title"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id="trial-modal-title" className={styles.title}>
            Trial Product Summary
            <span className={styles.trialBadge}>14-Day Trial</span>
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Success banner */}
          {isSuccess && (
            <div className={styles.successBanner} role="status">
              <strong>Trial order activated successfully!</strong>
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
            </div>
          )}

          {/* Error banner */}
          {state.status === 'error' && state.error && (
            <div className={styles.errorBanner} role="alert">
              <strong>Error:</strong> {state.error}
            </div>
          )}

          {/* Summary table — always visible */}
          <table className={styles.summaryTable}>
            <tbody>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Product</td>
                <td className={styles.rowValue}>{productName}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Selling Model</td>
                <td className={styles.rowValue}>{sellingModel || '—'}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Quantity</td>
                <td className={styles.rowValue}>{quantity}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Trial Start</td>
                <td className={styles.rowValue}>{formatDate(startDate)}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Trial End</td>
                <td className={styles.rowValue}>{formatDate(endDate)}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Unit Price</td>
                <td className={`${styles.rowValue} ${styles.rowValueFree}`}>$0.00</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.rowLabel}>Total</td>
                <td className={`${styles.rowValue} ${styles.rowValueFree}`}>$0.00</td>
              </tr>
              {accountName && (
                <tr className={styles.summaryRow}>
                  <td className={styles.rowLabel}>Account</td>
                  <td className={styles.rowValue}>{accountName}</td>
                </tr>
              )}
            </tbody>
          </table>

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
              {state.lifecycleSteps.map((step, i) => (
                (step.url || step.response || step.error) ? (
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
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isLoading}
          >
            {isSuccess ? 'Close' : 'Cancel'}
          </button>
          {!isSuccess && (
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading && <span className={styles.spinner} aria-hidden />}
              {isLoading ? spinnerLabel : 'Confirm Trial'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
