import { useEffect, useId, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ProductImageGallery } from '../components/products/detail/ProductImageGallery'
import { SalesforcePricingPanel } from '../components/products/detail/SalesforcePricingPanel'
import { AppBreadcrumbs } from '../components/navigation/AppBreadcrumbs'
import { modelDetailsBySlug, productGalleryImages } from '../data/product-models'
import { useCatalog } from '../catalog/CatalogContext'
import { useSalesforcePricing } from '../hooks/useSalesforcePricing'
import { useProductSellingModels } from '../hooks/useProductSellingModels'
import { useHeadlessPricingConfig } from '../salesforce/HeadlessPricingConfigContext'
import { buildHeadlessPricingData } from '../salesforce/buildHeadlessPricingData'
import styles from './ProductDetailPage.module.css'

const MAX_QTY = 99

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function formatMoney(amount: number, currencyIsoCode: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyIsoCode || 'USD',
  }).format(amount)
}

export function ProductDetailPage() {
  const { productSlug = '' } = useParams<{ productSlug: string }>()
  const sellingModelId = useId()

  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [qtyInput, setQtyInput] = useState('1')
  const [committedQuantity, setCommittedQuantity] = useState(1)
  const [sellingModel, setSellingModel] = useState('')

  const { catalog } = useCatalog()
  const catalogProduct = catalog.products.find((p) => p.id === productSlug)

  // Supplemental hardcoded data for the two original products
  const detail = modelDetailsBySlug[productSlug]

  const sellingModels = useProductSellingModels()
  const selectedSellingModelId = sellingModels.find((m) => m.name === sellingModel)?.id

  useEffect(() => {
    if (sellingModel === '' && sellingModels.length > 0) {
      setSellingModel(sellingModels[0].name)
    }
  }, [sellingModels])

  const { config: headlessConfig, isComplete: headlessComplete } = useHeadlessPricingConfig()

  const pricing = useSalesforcePricing(
    catalogProduct?.sfProductId ?? '',
    committedQuantity,
    selectedSellingModelId,
    sellingModel,
  )

  const requestPayload = useMemo(() => {
    if (!headlessComplete || !catalogProduct?.sfProductId) return undefined
    const pricingDataObj = buildHeadlessPricingData({
      product2Id: catalogProduct.sfProductId,
      quantity: committedQuantity,
      productSellingModelId: selectedSellingModelId,
      pricebookId: headlessConfig.pricebookId || undefined,
      startDate: headlessConfig.effectiveDate.trim() || undefined,
    })

    // Field order matches the canonical Salesforce example
    const input: Record<string, unknown> = {
      contextMappingId: headlessConfig.contextMappingId,
      contextDefinitionId: headlessConfig.contextDefinitionId,
      pricingProcedureId: headlessConfig.pricingProcedureId,
    }
    if (headlessConfig.discoveryProcedure.trim())
      input.discoveryProcedure = headlessConfig.discoveryProcedure.trim()
    input.displayContext = headlessConfig.displayContext
    if (headlessConfig.effectiveDate.trim())
      input.effectiveDate = headlessConfig.effectiveDate.trim()
    input.isHighVolumeLineItems = headlessConfig.isHighVolumeLineItems
    input.skipDiscovery = headlessConfig.skipDiscovery
    input.taggedData = headlessConfig.taggedData
    input.pricingData = JSON.stringify(pricingDataObj)
    input.isSkipWaterfall = headlessConfig.isSkipWaterfall
    input.persistContext = headlessConfig.persistContext
    input.useSessionScopedContext = headlessConfig.useSessionScopedContext

    return { inputs: [input] }
  }, [
    headlessComplete,
    headlessConfig,
    catalogProduct,
    committedQuantity,
    selectedSellingModelId,
  ])

  const unitPriceDisplay = useMemo(() => {
    if (pricing.status === 'ok') {
      return formatMoney(pricing.record.netUnitPrice, pricing.record.currencyIsoCode)
    }
    return priceFormatter.format(detail?.unitPriceUsd ?? 0)
  }, [pricing, detail])

  const lineTotalDisplay = useMemo(() => {
    if (pricing.status === 'ok') {
      return formatMoney(pricing.record.subtotal, pricing.record.currencyIsoCode)
    }
    return priceFormatter.format((detail?.unitPriceUsd ?? 0) * quantity)
  }, [pricing, detail, quantity])

  if (!catalogProduct) {
    return <Navigate to="/" replace />
  }

  const galleryImages: readonly { src: string; alt: string }[] =
    catalogProduct.imageUrl.trim()
      ? [{ src: catalogProduct.imageUrl, alt: catalogProduct.name }]
      : productGalleryImages

  const bumpQty = (delta: number) => {
    const next = Math.min(MAX_QTY, Math.max(1, quantity + delta))
    setQuantity(next)
    setQtyInput(String(next))
    setCommittedQuantity(next)
  }

  return (
    <div className={styles.wrap}>
      <AppBreadcrumbs productName={catalogProduct.name} />

      <div className={styles.grid}>
        <div className={styles.left}>
          <article>
            <h1 className={styles.title}>{catalogProduct.name}</h1>
            {catalogProduct.family && (
              <p className={styles.threat}>{catalogProduct.family}</p>
            )}
            {catalogProduct.description && (
              <p className={styles.summary}>{catalogProduct.description}</p>
            )}

            {detail?.highlights && detail.highlights.length > 0 && (
              <>
                <h2 className={styles.h2}>Highlights</h2>
                <ul className={styles.list}>
                  {detail.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            {detail?.specs && detail.specs.length > 0 && (
              <>
                <h2 className={styles.h2}>Specifications</h2>
                <dl className={styles.specs}>
                  {detail.specs.map((s) => (
                    <div key={s.label} className={styles.specRow}>
                      <dt>{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            <section className={styles.configPanel} aria-labelledby="config-heading">
              <h2 id="config-heading" className={styles.configTitle}>
                Configuration Options
              </h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={sellingModelId}>
                  Selling Model
                </label>
                <select
                  id={sellingModelId}
                  className={styles.select}
                  value={sellingModel}
                  onChange={(e) => setSellingModel(e.target.value)}
                >
                  {sellingModels.length === 0 && (
                    <option value="">No selling models configured</option>
                  )}
                  {sellingModels.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          </article>
        </div>

        <aside className={styles.right}>
          {galleryImages.length > 0 && (
            <ProductImageGallery
              images={galleryImages}
              activeIndex={activeGalleryIndex}
              onSelectIndex={setActiveGalleryIndex}
            />
          )}
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
                <input
                  type="number"
                  className={styles.qtyValue}
                  value={qtyInput}
                  min={1}
                  max={MAX_QTY}
                  aria-label="Quantity"
                  onChange={(e) => {
                    setQtyInput(e.target.value)
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val) && val >= 1) setQuantity(Math.min(MAX_QTY, val))
                  }}
                  onBlur={() => {
                    const clamped = Math.min(MAX_QTY, Math.max(1, quantity))
                    setQuantity(clamped)
                    setQtyInput(String(clamped))
                    setCommittedQuantity(clamped)
                  }}
                />
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
              <div className={styles.priceRow}>
                <span className={styles.priceLabel}>
                  Unit Price{pricing.status === 'loading' ? ' …' : ''}
                </span>
                <p className={styles.unitPriceValue} aria-live="polite">
                  {pricing.status === 'loading' ? '—' : unitPriceDisplay}
                </p>
              </div>
              <div className={styles.priceRow}>
                <span className={styles.priceLabel}>
                  Price{pricing.status === 'loading' ? ' …' : ''}
                </span>
                <p className={styles.priceValue} aria-live="polite">
                  {pricing.status === 'loading' ? '—' : lineTotalDisplay}
                </p>
              </div>
            </div>
          </div>

          <SalesforcePricingPanel pricing={pricing} requestPayload={requestPayload} />
        </aside>
      </div>
    </div>
  )
}
