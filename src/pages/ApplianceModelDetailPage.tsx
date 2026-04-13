import { useId, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ProductImageGallery } from '../components/appliance-models/detail/ProductImageGallery'
import { SalesforcePricingPanel } from '../components/appliance-models/detail/SalesforcePricingPanel'
import { AppBreadcrumbs } from '../components/navigation/AppBreadcrumbs'
import {
  getModelBySlug,
  isDetailSlug,
  modelDetailsBySlug,
  productGalleryImages,
} from '../data/appliance-models'
import { useSalesforcePricing } from '../hooks/useSalesforcePricing'
import styles from './ApplianceModelDetailPage.module.css'

const MAX_QTY = 99

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const consolePortOptions = Array.from({ length: 8 }, (_, i) => String(i + 1))

export function ApplianceModelDetailPage() {
  const { modelSlug = '' } = useParams<{ modelSlug: string }>()
  const customerId = useId()
  const portsId = useId()

  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [customer, setCustomer] = useState('pied-piper')
  const [consolePorts, setConsolePorts] = useState('1')

  const row = isDetailSlug(modelSlug) ? getModelBySlug(modelSlug) : undefined
  const detail = isDetailSlug(modelSlug) ? modelDetailsBySlug[modelSlug] : undefined

  const pricing = useSalesforcePricing(detail?.sfProductId ?? '')

  const totalPrice = useMemo(() => {
    const unitPrice =
      pricing.status === 'ok' ? pricing.record.UnitPrice : detail?.unitPriceUsd ?? 0
    return priceFormatter.format(unitPrice * quantity)
  }, [pricing, detail, quantity])

  if (!detail || !row) {
    return <Navigate to="/" replace />
  }

  const bumpQty = (delta: number) => {
    setQuantity((q) => Math.min(MAX_QTY, Math.max(1, q + delta)))
  }

  return (
    <div className={styles.wrap}>
      <AppBreadcrumbs modelName={detail.name} />

      <div className={styles.grid}>
        <div className={styles.left}>
          <article>
            <h1 className={styles.title}>{detail.name}</h1>
            <p className={styles.threat}>
              Threat protection (reference): <strong>{detail.threatProtection}</strong>
            </p>
            <p className={styles.summary}>{detail.summary}</p>

            <h2 className={styles.h2}>Highlights</h2>
            <ul className={styles.list}>
              {detail.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2 className={styles.h2}>Specifications</h2>
            <dl className={styles.specs}>
              {detail.specs.map((s) => (
                <div key={s.label} className={styles.specRow}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>

            <section className={styles.configPanel} aria-labelledby="config-heading">
              <h2 id="config-heading" className={styles.configTitle}>
                Configuration Options
              </h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={customerId}>
                  Customer
                </label>
                <select
                  id={customerId}
                  className={styles.select}
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                >
                  <option value="pied-piper">Pied Piper</option>
                  <option value="hooli">Hooli</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={portsId}>
                  Console ports
                </label>
                <select
                  id={portsId}
                  className={styles.select}
                  value={consolePorts}
                  onChange={(e) => setConsolePorts(e.target.value)}
                >
                  {consolePortOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <p className={styles.note}>
              Product datasheet and overview video resources are represented in the appliance models
              table with icons; this demo keeps all navigation inside the app.
            </p>
          </article>
        </div>

        <aside className={styles.right}>
          <ProductImageGallery
            images={productGalleryImages}
            activeIndex={activeGalleryIndex}
            onSelectIndex={setActiveGalleryIndex}
          />
          <div className={styles.purchaseRow}>
            <div className={styles.qtyBlock}>
              <span className={styles.qtyLabel}>Quantity</span>
              <div className={styles.qtyControls}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => bumpQty(-1)}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className={styles.qtyValue} aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => bumpQty(1)}
                  disabled={quantity >= MAX_QTY}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
            <div className={styles.priceBlock}>
              <span className={styles.priceLabel}>
                Price{pricing.status === 'loading' ? ' …' : ''}
              </span>
              <p className={styles.priceValue} aria-live="polite">
                {pricing.status === 'loading' ? '—' : totalPrice}
              </p>
            </div>
          </div>

          <SalesforcePricingPanel pricing={pricing} />
        </aside>
      </div>
    </div>
  )
}
