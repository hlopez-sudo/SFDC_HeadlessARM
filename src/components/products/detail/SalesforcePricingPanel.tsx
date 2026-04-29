import type { SalesforcePricingState, WaterfallStep } from '../../../hooks/useSalesforcePricing'
import { parseHeadlessWaterfallSteps } from '../../../salesforce/parseHeadlessPricingWaterfall'
import styles from './SalesforcePricingPanel.module.css'

const currencyFormatter = (code: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code || 'USD',
    minimumFractionDigits: 2,
  })

const pctFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function adjustmentLabel(step: WaterfallStep, fmt: Intl.NumberFormat): string {
  if (step.adjustmentPercent != null && step.adjustmentPercent !== 0) {
    return pctFormatter.format(step.adjustmentPercent / 100)
  }
  if (step.adjustmentAmount !== 0) {
    return fmt.format(step.adjustmentAmount)
  }
  return '—'
}

type Props = {
  pricing: SalesforcePricingState
  requestPayload?: Record<string, unknown>
}

export function SalesforcePricingPanel({ pricing, requestPayload }: Props) {
  return (
    <section className={styles.panel} aria-label="Revenue Cloud Pricing API Response Details">
      <h3 className={styles.title}>Revenue Cloud Pricing API Response Details</h3>

      {pricing.status === 'loading' && (
        <p className={styles.loading}>Fetching pricing data…</p>
      )}

      {pricing.status === 'error' && (
        <p className={styles.errorMsg}>{pricing.error}</p>
      )}

      {pricing.status === 'ok' && (() => {
        const { record, source } = pricing
        const fmt = currencyFormatter(record.currencyIsoCode)
        const sorted = [...record.steps].sort((a, b) => a.sequence - b.sequence)
        const headlessSteps =
          source === 'headless' ? parseHeadlessWaterfallSteps(pricing.raw) : []

        return (
          <>
            {source === 'headless' && (
              <p className={styles.sourceNotice} role="status">
                Price from <strong>Headless Pricing action</strong>{' '}
                (<code className={styles.inlineCode}>runSalesforceHeadlessPricing</code>).
              </p>
            )}

            {source === 'headless' && headlessSteps.length > 0 && (
              <details className={styles.waterfallDetails}>
                <summary className={styles.waterfallSummary}>Headless pricing waterfall</summary>
                <div className={styles.headlessTableWrap}>
                  <table className={`${styles.stepsTable} ${styles.headlessWaterfallTable}`}>
                    <thead>
                      <tr>
                        <th className={styles.thSeq}>#</th>
                        <th className={styles.thHeadlessStep}>Step</th>
                        <th className={styles.thHeadlessType}>Type</th>
                        <th className={`${styles.th} ${styles.thNum} ${styles.thHeadlessMoney}`}>
                          Net unit price
                        </th>
                        <th className={`${styles.th} ${styles.thNum} ${styles.thHeadlessMoney}`}>
                          Subtotal
                        </th>
                        <th className={styles.thHeadlessTask}>Task</th>
                      </tr>
                    </thead>
                    <tbody>
                      {headlessSteps.map((step, idx) => (
                        <tr key={`${step.sequence}-${idx}-${step.name}`} className={styles.stepRow}>
                          <td className={styles.tdSeq}>{step.sequence}</td>
                          <td className={`${styles.td} ${styles.tdBreak}`}>{step.name}</td>
                          <td className={styles.td}>
                            <span className={styles.typeBadge}>{step.elementType}</span>
                          </td>
                          <td className={`${styles.td} ${styles.tdNum} ${styles.tdMoney}`}>
                            {step.stepNetUnitPrice != null ? fmt.format(step.stepNetUnitPrice) : '—'}
                          </td>
                          <td className={`${styles.td} ${styles.tdNum} ${styles.tdMoney}`}>
                            {step.stepSubtotal != null ? fmt.format(step.stepSubtotal) : '—'}
                          </td>
                          <td className={`${styles.td} ${styles.tdMonoBreak}`}>
                            {step.taskHint ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {source === 'headless' && headlessSteps.length === 0 && (
              <p className={styles.waterfallParseHint}>
                Waterfall steps could not be parsed; see Headless API Response below.
              </p>
            )}

            {sorted.length > 0 && (
              <div className={styles.stepsWrapper}>
                <p className={styles.stepsHeading}>Pricing Waterfall Steps</p>
                <table className={styles.stepsTable}>
                  <thead>
                    <tr>
                      <th className={styles.thSeq}>#</th>
                      <th className={styles.th}>Step</th>
                      <th className={styles.th}>Type</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Adjustment</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Net Unit Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((step) => {
                      const adjSign =
                        step.adjustmentAmount < 0 ||
                        (step.adjustmentPercent != null && step.adjustmentPercent < 0)
                          ? 'negative'
                          : step.adjustmentAmount > 0 ||
                              (step.adjustmentPercent != null && step.adjustmentPercent > 0)
                            ? 'positive'
                            : 'neutral'

                      return (
                        <tr key={step.sequence} className={styles.stepRow}>
                          <td className={styles.tdSeq}>{step.sequence}</td>
                          <td className={styles.td}>{step.name}</td>
                          <td className={styles.td}>
                            <span className={styles.typeBadge}>{step.adjustmentType}</span>
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`}>
                            <span
                              className={
                                adjSign === 'negative'
                                  ? styles.adjNegative
                                  : adjSign === 'positive'
                                    ? styles.adjPositive
                                    : styles.adjNeutral
                              }
                            >
                              {adjustmentLabel(step, fmt)}
                            </span>
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`}>
                            {fmt.format(step.netUnitPrice)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {requestPayload && (
              <details className={styles.waterfallDetails}>
                <summary className={styles.waterfallSummary}>API Request JSON</summary>
                <div className={styles.headlessTableWrap}>
                  <pre className={styles.rawPre}>{JSON.stringify(requestPayload, null, 2)}</pre>
                </div>
              </details>
            )}

            {source !== 'headless' && pricing.headlessAttemptRaw !== undefined && (
              <details className={styles.waterfallDetails}>
                <summary className={styles.waterfallSummary}>Headless Pricing Attempt</summary>
                <div className={styles.headlessTableWrap}>
                  <pre className={styles.rawPre}>{JSON.stringify(pricing.headlessAttemptRaw, null, 2)}</pre>
                </div>
              </details>
            )}

            <details className={styles.waterfallDetails}>
              <summary className={styles.waterfallSummary}>
                {source === 'headless'
                  ? 'Headless API Response'
                  : source === 'pricebook_soql'
                    ? 'Fallback SOQL Result'
                    : 'RLM API Response'}
              </summary>
              <div className={styles.headlessTableWrap}>
                <pre className={styles.rawPre}>{JSON.stringify(pricing.raw, null, 2)}</pre>
              </div>
            </details>
          </>
        )
      })()}
    </section>
  )
}
