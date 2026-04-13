import type { SalesforcePricingState } from '../../../hooks/useSalesforcePricing'
import styles from './SalesforcePricingPanel.module.css'

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

type Props = {
  pricing: SalesforcePricingState
}

export function SalesforcePricingPanel({ pricing }: Props) {
  return (
    <section className={styles.panel} aria-label="Revenue Cloud Pricing API Response Details">
      <h3 className={styles.title}>Revenue Cloud Pricing API Response Details</h3>

      {pricing.status === 'loading' && (
        <p className={styles.loading}>Fetching pricing data…</p>
      )}

      {pricing.status === 'error' && (
        <p className={styles.errorMsg}>{pricing.error}</p>
      )}

      {pricing.status === 'ok' && (
        <>
          <dl className={styles.grid}>
            <div className={styles.row}>
              <dt className={styles.dt}>PricebookEntry Id</dt>
              <dd className={styles.dd}>
                <code className={styles.code}>{pricing.record.Id}</code>
              </dd>
            </div>

            <div className={styles.row}>
              <dt className={styles.dt}>Unit price</dt>
              <dd className={styles.dd}>
                <span className={styles.priceHighlight}>
                  {usdFormatter.format(pricing.record.UnitPrice)}
                </span>
              </dd>
            </div>

            <div className={styles.row}>
              <dt className={styles.dt}>Currency</dt>
              <dd className={styles.dd}>{pricing.record.CurrencyIsoCode}</dd>
            </div>

            <div className={styles.row}>
              <dt className={styles.dt}>Price book</dt>
              <dd className={styles.dd}>
                {pricing.record.Pricebook2.Name}
                <span className={styles.subtle}> ({pricing.record.Pricebook2Id})</span>
              </dd>
            </div>
          </dl>

          <details className={styles.rawDetails}>
            <summary className={styles.rawSummary}>Raw API response</summary>
            <pre className={styles.rawPre}>{JSON.stringify(pricing.raw, null, 2)}</pre>
          </details>
        </>
      )}
    </section>
  )
}
