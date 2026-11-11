import type { LifecycleStep } from '../../quote/useBuyNow'
import styles from '../quote/TrialDrawer.module.css'

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

export function LifecycleStepList({ steps }: { steps: LifecycleStep[] }) {
  if (steps.length === 0) return null

  return (
    <div>
      <ul className={styles.stepList}>
        {steps.map((step, i) => (
          <li key={i} className={stepItemClass(step.status)}>
            <StepIcon step={step} />
            <span className={styles.stepName}>{step.name}</span>
          </li>
        ))}
      </ul>

      {steps.map((step, i) =>
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
        ) : null,
      )}
    </div>
  )
}
