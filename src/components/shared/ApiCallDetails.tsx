import styles from '../quote/TrialDrawer.module.css'

type ApiCallDetailsProps = {
  url: string | null
  method?: string
  requestBody: unknown | null
  response?: unknown | null
  requestLabel?: string
  responseLabel?: string
}

export function ApiCallDetails({
  url,
  method = 'POST',
  requestBody,
  response = null,
  requestLabel = 'Request Body',
  responseLabel = 'Response',
}: ApiCallDetailsProps) {
  return (
    <>
      {url && (
        <details className={styles.detailsBlock}>
          <summary className={styles.detailsSummary}>Endpoint</summary>
          <div className={styles.detailsContent}>
            <p className={styles.endpointLine}>
              <span className={styles.methodBadge}>{method}</span>
              {url}
            </p>
          </div>
        </details>
      )}

      {requestBody !== null && (
        <details className={styles.detailsBlock}>
          <summary className={styles.detailsSummary}>{requestLabel}</summary>
          <pre className={styles.codeBlock}>
            {JSON.stringify(requestBody, null, 2)}
          </pre>
        </details>
      )}

      {response !== null && (
        <details className={styles.detailsBlock}>
          <summary className={styles.detailsSummary}>{responseLabel}</summary>
          <pre className={styles.codeBlock}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </details>
      )}
    </>
  )
}
