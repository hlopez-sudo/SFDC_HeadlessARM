import { useState } from 'react'
import { useSiteBranding } from '../branding/SiteBrandingContext'
import type { PlgProductRef } from '../branding/types'
import { useSalesforcePricing } from '../hooks/useSalesforcePricing'
import { useProductSellingModelOptions } from '../hooks/useProductSellingModelOptions'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import { useTrialDrawer } from '../quote/TrialDrawerContext'
import { useBuyNowDrawer } from '../quote/BuyNowDrawerContext'
import styles from './SignUpNowPage.module.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getAccountName(): string | null {
  try {
    const raw = localStorage.getItem('fc-active-account')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { accountName?: string }
    return parsed?.accountName ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// TrialTile
// ---------------------------------------------------------------------------

function TrialTile({
  product,
  instanceUrl,
  onStartTrial,
}: {
  product: PlgProductRef
  instanceUrl: string
  onStartTrial: () => void
}) {
  const productName = product.name || 'Trial'

  return (
    <div className={styles.tile}>
      <div className={styles.tileHeader}>
        <span className={styles.tierLabel}>Trial</span>
        <h2 className={styles.productName}>{productName}</h2>
        {product.displayUrl && (
          <img
            className={styles.tileImage}
            src={`${instanceUrl}${product.displayUrl}`}
            alt={productName}
          />
        )}
      </div>

      <div className={styles.tileBody}>
        {product.description && (
          <p className={styles.tileDescription}>{product.description}</p>
        )}

        <div className={styles.qtyBlock}>
          <span className={styles.qtyLabel}>Quantity</span>
          <span className={styles.qtyFixed}>1</span>
        </div>

        <div className={styles.priceSection}>
          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>Total</span>
            <span className={styles.totalPrice}>{priceFormatter.format(0)}</span>
          </div>
          <p className={styles.trialMsg}>
            Trial costs $0 up front and will last for 14 Days.
          </p>
        </div>
      </div>

      <div className={styles.tileFooter}>
        <button
          type="button"
          className={styles.btnOutline}
          disabled={!product.id}
          onClick={onStartTrial}
        >
          Start Trial
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PricingTile  (Professional + Enterprise — full Buy Now drawer)
// ---------------------------------------------------------------------------

type PricingTileProps = {
  tierLabel: string
  product: PlgProductRef
  minQty: number
  maxQty: number
  defaultQty: number
  instanceUrl: string
  mostPopular?: boolean
}

function PricingTile({ tierLabel, product, minQty, maxQty, defaultQty, instanceUrl, mostPopular }: PricingTileProps) {
  const [qty, setQty] = useState(defaultQty)
  const [qtyInput, setQtyInput] = useState(String(defaultQty))
  const [committedQty, setCommittedQty] = useState(defaultQty)
  const [termToggle, setTermToggle] = useState<'annual' | 'monthly'>('annual')

  const { openBuyNow } = useBuyNowDrawer()

  const sellingModels = useProductSellingModelOptions(product.id)

  const annualModel = sellingModels.find((m) => m.name.toLowerCase().includes('annual'))
  const monthlyModel = sellingModels.find((m) => m.name.toLowerCase().includes('month'))
  const selectedModel =
    termToggle === 'annual'
      ? (annualModel ?? sellingModels[0])
      : (monthlyModel ?? sellingModels[0])

  const pricing = useSalesforcePricing(
    product.id,
    committedQty,
    selectedModel?.id,
    selectedModel?.name,
  )

  const productName = product.name || tierLabel

  const unitPriceDisplay =
    pricing.status === 'ok'
      ? formatMoney(pricing.record.netUnitPrice, pricing.record.currencyIsoCode)
      : pricing.status === 'loading'
      ? '—'
      : priceFormatter.format(0)

  const totalPriceDisplay =
    pricing.status === 'ok'
      ? formatMoney(pricing.record.subtotal, pricing.record.currencyIsoCode)
      : pricing.status === 'loading'
      ? '—'
      : priceFormatter.format(0)

  const bumpQty = (delta: number) => {
    const next = Math.min(maxQty, Math.max(minQty, qty + delta))
    setQty(next)
    setQtyInput(String(next))
    setCommittedQty(next)
  }

  const commitQty = () => {
    const clamped = Math.min(maxQty, Math.max(minQty, qty))
    setQty(clamped)
    setQtyInput(String(clamped))
    setCommittedQty(clamped)
  }

  return (
    <div className={`${styles.tile} ${mostPopular ? styles.tileFeatured : ''}`}>
      <div className={styles.tileHeader}>
        {mostPopular && (
          <div className={styles.mostPopularBanner}>Most Popular</div>
        )}
        <span className={styles.tierLabel}>{tierLabel}</span>
        <h2 className={styles.productName}>{productName}</h2>
        {product.displayUrl && (
          <img
            className={styles.tileImage}
            src={`${instanceUrl}${product.displayUrl}`}
            alt={productName}
          />
        )}
      </div>

      <div className={styles.tileBody}>
        {product.description && (
          <p className={styles.tileDescription}>{product.description}</p>
        )}

        <div className={styles.qtyBlock}>
          <div className={styles.qtyRow}>
            <div>
              <span className={styles.qtyLabel}>Quantity</span>
              <div className={styles.qtyControls}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => bumpQty(-1)}
                  disabled={qty <= minQty}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  type="number"
                  className={styles.qtyValue}
                  value={qtyInput}
                  min={minQty}
                  max={maxQty}
                  aria-label="Quantity"
                  onChange={(e) => {
                    setQtyInput(e.target.value)
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val) && val >= minQty) setQty(Math.min(maxQty, val))
                  }}
                  onBlur={commitQty}
                />
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => bumpQty(1)}
                  disabled={qty >= maxQty}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            <div className={styles.termToggle} role="group" aria-label="Billing term">
              <button
                type="button"
                className={termToggle === 'monthly' ? styles.termActive : styles.termBtn}
                onClick={() => setTermToggle('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={termToggle === 'annual' ? styles.termActive : styles.termBtn}
                onClick={() => setTermToggle('annual')}
              >
                Annual
              </button>
            </div>
          </div>
        </div>

        <div className={styles.priceSection}>
          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>
              Unit Price{pricing.status === 'loading' ? ' …' : ''}
            </span>
            <span className={styles.unitPrice} aria-live="polite">
              {unitPriceDisplay}
            </span>
          </div>
          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>
              Total{pricing.status === 'loading' ? ' …' : ''}
            </span>
            <span className={styles.totalPrice} aria-live="polite">
              {totalPriceDisplay}
            </span>
          </div>
          {pricing.status === 'error' && (
            <p className={styles.pricingError}>{pricing.error}</p>
          )}
        </div>
      </div>

      <div className={styles.tileFooter}>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!product.id}
          onClick={() =>
            openBuyNow({
              productId: product.id,
              productName,
              sellingModel: selectedModel?.name ?? '',
              sellingModelId: selectedModel?.id,
              quantity: committedQty,
              unitPrice: pricing.status === 'ok' ? pricing.record.netUnitPrice : 0,
              currencyIsoCode: pricing.status === 'ok' ? pricing.record.currencyIsoCode : 'USD',
              accountName: getAccountName(),
            })
          }
        >
          Buy Now
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CustomTile  (Contact Sales placeholder)
// ---------------------------------------------------------------------------

function CustomTile({
  product,
  instanceUrl,
}: {
  product: PlgProductRef
  instanceUrl: string
}) {
  const productName = product.name || 'Custom'

  return (
    <div className={styles.tile}>
      <div className={styles.tileHeader}>
        <span className={styles.tierLabel}>Custom</span>
        <h2 className={styles.productName}>{productName}</h2>
        {product.displayUrl && (
          <img
            className={styles.tileImage}
            src={`${instanceUrl}${product.displayUrl}`}
            alt={productName}
          />
        )}
      </div>

      <div className={styles.tileBody}>
        {product.description && (
          <p className={styles.tileDescription}>{product.description}</p>
        )}

        <div className={styles.priceSection}>
          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>Pricing</span>
            <span className={styles.totalPrice}>Custom</span>
          </div>
          <p className={styles.trialMsg}>
            Contact our sales team to discuss pricing and volume options tailored to your needs.
          </p>
        </div>
      </div>

      <div className={styles.tileFooter}>
        <button
          type="button"
          className={styles.btnOutline}
          disabled={!product.id}
        >
          Contact Sales
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function SignUpNowPage() {
  const { branding } = useSiteBranding()
  const { orgInfo } = useSalesforceConfig()
  const instanceUrl = orgInfo.instanceUrl
  const { openTrial } = useTrialDrawer()

  const anyConfigured =
    branding.plgTrialProduct.id ||
    branding.plgBuyNowProduct.id ||
    branding.plgEnterpriseProduct.id ||
    branding.plgCustomProduct.id

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Sign Up Now</h1>
      <p className={styles.lead}>
        Choose the plan that works best for you.
      </p>

      {!anyConfigured ? (
        <p className={styles.notConfigured}>
          No products configured yet. Enable PLG and assign products in Administration → General.
        </p>
      ) : (
        <>
          <div className={styles.tilesGrid}>
            <TrialTile
              product={branding.plgTrialProduct}
              instanceUrl={instanceUrl}
              onStartTrial={() =>
                openTrial({
                  productId: branding.plgTrialProduct.id,
                  productName: branding.plgTrialProduct.name || 'Trial',
                  sellingModel: '',
                  quantity: 1,
                  accountName: getAccountName(),
                })
              }
            />

            <PricingTile
              tierLabel="Professional"
              product={branding.plgBuyNowProduct}
              minQty={2}
              maxQty={10}
              defaultQty={2}
              instanceUrl={instanceUrl}
              mostPopular
            />

            <PricingTile
              tierLabel="Enterprise"
              product={branding.plgEnterpriseProduct}
              minQty={11}
              maxQty={50}
              defaultQty={11}
              instanceUrl={instanceUrl}
            />

            <CustomTile
              product={branding.plgCustomProduct}
              instanceUrl={instanceUrl}
            />
          </div>
        </>
      )}
    </div>
  )
}
