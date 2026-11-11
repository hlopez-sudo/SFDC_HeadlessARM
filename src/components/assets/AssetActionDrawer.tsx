import { useEffect, useMemo, useRef, useState } from 'react'
import { useSalesforceConfig } from '../../salesforce/SalesforceConfigContext'
import type { AssetRecord } from '../../hooks/useAccountAssets'
import { useAssetAction } from '../../quote/useAssetAction'
import {
  OUTPUT_RECORD_TYPES,
  TARGET_LOOKUP,
  allowedOutputTypes,
  buildAssetActionRequests,
  formatBoundaryOffset,
  initialAssetActionForm,
  selectionBoundaryOffsetMs,
  swapTargetFromRecord,
  targetLookupWhere,
  validateAssetActionForm,
  type AssetActionDef,
  type AssetActionForm,
  type SwapLine,
} from '../../salesforce/assetActions'
import { formatDate, formatMoney } from '../../lib/format'
import { ApiCallDetails } from '../shared/ApiCallDetails'
import { LifecycleStepList } from '../shared/LifecycleStepList'
import { SalesforceLookupInput } from '../salesforce/SalesforceLookupInput'
import styles from '../quote/TrialDrawer.module.css'
import tableStyles from '../quote/OrderCartDrawer.module.css'
import formStyles from './AssetActionDrawer.module.css'

const TARGET_PRICE_HINTS: Record<string, string> = {
  above: 'priced above the current price',
  below: 'priced below the current price',
  any: 'at any price',
}

type AssetActionDrawerProps = {
  action: AssetActionDef
  assets: AssetRecord[]
  isMultiCurrency: boolean
  onClose: () => void
  /** Fires once a Quote/Order has been created, even if a later step failed. */
  onCompleted: () => void
}

export function AssetActionDrawer({ action, assets, isMultiCurrency, onClose, onCompleted }: AssetActionDrawerProps) {
  const { orgInfo } = useSalesforceConfig()
  const { submit, state, reset } = useAssetAction()
  const [form, setForm] = useState<AssetActionForm>(() => initialAssetActionForm(action, assets))
  const [activate, setActivate] = useState(false)
  const notified = useRef(false)

  const isIdle = state.status === 'idle'
  const isLoading = state.status === 'loading'
  const isSuccess = state.status === 'success'
  const outputTypes = allowedOutputTypes(action, assets)
  const timeZone = formatBoundaryOffset(selectionBoundaryOffsetMs(assets))
  const currency = assets[0]?.currencyIsoCode ?? undefined
  const validationError = validateAssetActionForm(action, assets, form)
  const preview = useMemo(
    () => buildAssetActionRequests(action, assets, form, orgInfo.apiVersion),
    [action, assets, form, orgInfo.apiVersion],
  )
  const recordUrl = state.recordId && orgInfo.instanceUrl ? `${orgInfo.instanceUrl}/${state.recordId}` : null

  useEffect(() => {
    if (state.recordId && !isLoading && !notified.current) {
      notified.current = true
      onCompleted()
    }
  }, [state.recordId, isLoading, onCompleted])

  function update(patch: Partial<AssetActionForm>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function updateQuantityChange(assetId: string, change: number) {
    setForm((prev) => ({ ...prev, quantityChanges: { ...prev.quantityChanges, [assetId]: change } }))
  }

  function updateSwapLine(assetId: string, patch: Partial<SwapLine>) {
    setForm((prev) => ({
      ...prev,
      swapLines: { ...prev.swapLines, [assetId]: { ...prev.swapLines[assetId], ...patch } },
    }))
  }

  function handleClose() {
    if (!isLoading) onClose()
  }

  function handleConfirm() {
    if (validationError) return
    submit(action, assets, form, activate)
  }

  return (
    <>
      <div className={styles.backdrop} onClick={handleClose} aria-hidden />

      <div className={`${styles.drawer} ${styles.drawerOpen}`} role="dialog" aria-modal aria-label={`${action.label} assets`}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>
            {action.label} Assets
            <span className={styles.trialBadge}>
              {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
            </span>
          </span>
          <button type="button" className={styles.closeBtn} onClick={handleClose} disabled={isLoading} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.drawerBody}>
          {isSuccess && (
            <div className={styles.successBanner} role="status">
              <strong>
                {form.outputRecordType} created{activate && form.outputRecordType === 'Order' ? ' and activated' : ''}.
              </strong>
              {state.recordId && (
                <span>
                  {form.outputRecordType} ID: <span className={styles.orderId}>{state.recordId}</span>
                </span>
              )}
              {recordUrl && (
                <a href={recordUrl} target="_blank" rel="noopener noreferrer" className={styles.sfLink}>
                  View in Salesforce →
                </a>
              )}
              <button type="button" className={styles.resetBtn} onClick={onClose}>
                Done
              </button>
            </div>
          )}

          {state.status === 'error' && state.error && (
            <div className={styles.errorBanner} role="alert">
              <div><strong>Error:</strong> {state.error}</div>
              {state.recordId && (
                <span>
                  {form.outputRecordType} {state.recordId} was created.{' '}
                  {recordUrl && (
                    <a href={recordUrl} target="_blank" rel="noopener noreferrer">
                      View in Salesforce →
                    </a>
                  )}
                </span>
              )}
              {!state.recordId && action.family === 'swap' && state.apiResponse !== null && (
                <span>
                  Salesforce can still create an empty {form.outputRecordType} when this request fails. Check the
                  account's {form.outputRecordType}s before retrying.
                </span>
              )}
              {!state.recordId && (
                <button type="button" className={styles.resetBtn} onClick={reset}>
                  Edit and try again
                </button>
              )}
            </div>
          )}

          <div className={formStyles.tableWrap}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th className={tableStyles.th}>Asset</th>
                  <th className={tableStyles.th}>Current Quantity</th>
                  <th className={tableStyles.th}>Ends</th>
                  {action.family === 'swap' && <th className={tableStyles.th}>Unit Price</th>}
                  {action.quantityChangeField && <th className={tableStyles.th}>Quantity Change</th>}
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className={tableStyles.td}>
                      {asset.name}
                      {asset.sellingModelName && <div className={formStyles.fieldHint}>{asset.sellingModelName}</div>}
                    </td>
                    <td className={tableStyles.td}>{asset.quantity ?? '—'}</td>
                    <td className={tableStyles.td}>{formatDate(asset.endDate)}</td>
                    {action.family === 'swap' && (
                      <td className={tableStyles.td}>
                        {asset.currentUnitPrice != null ? formatMoney(asset.currentUnitPrice, currency) : '—'}
                      </td>
                    )}
                    {action.quantityChangeField && (
                      <td className={tableStyles.td}>
                        <input
                          type="number"
                          step="1"
                          className={formStyles.qtyInput}
                          aria-label={`Quantity change for ${asset.name}`}
                          value={form.quantityChanges[asset.id]}
                          disabled={!isIdle}
                          onChange={(e) => updateQuantityChange(asset.id, Number(e.target.value))}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {action.quantityChangeField && (
            <p className={formStyles.fieldHint}>
              Positive adds, negative removes. Assets with different changes are sent as separate requests that add to
              the same {form.outputRecordType}.
            </p>
          )}

          <fieldset className={formStyles.form} disabled={!isIdle}>
            <div className={formStyles.field}>
              <span className={formStyles.label}>Create as</span>
              <div className={formStyles.radioGroup}>
                {OUTPUT_RECORD_TYPES.map((type) => (
                  <label key={type} className={formStyles.radioLabel}>
                    <input
                      type="radio"
                      name="outputRecordType"
                      checked={form.outputRecordType === type}
                      disabled={!outputTypes.includes(type)}
                      onChange={() => update({ outputRecordType: type })}
                    />
                    {type}
                  </label>
                ))}
              </div>
              {outputTypes.length < OUTPUT_RECORD_TYPES.length && (
                <p className={formStyles.fieldHint}>
                  {action.label} of usage-based assets is only available as a {outputTypes.join(' or ')}.
                </p>
              )}
            </div>

            {form.outputRecordType === 'Order' && (
              <div className={formStyles.field}>
                <label className={formStyles.radioLabel}>
                  <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
                  Activate the order after it's created
                </label>
                <p className={formStyles.fieldHint}>Leave off to review the Draft order in Salesforce first.</p>
              </div>
            )}

            {action.dateField && (
              <div className={formStyles.field}>
                <label className={formStyles.label} htmlFor="asset-action-date">{action.dateLabel}</label>
                <input
                  id="asset-action-date"
                  type="date"
                  className={formStyles.input}
                  value={form.effectiveDate}
                  onChange={(e) => update({ effectiveDate: e.target.value })}
                />
                <p className={formStyles.fieldHint}>Leave blank to use the current time. Dates are in {timeZone}.</p>
              </div>
            )}

            {action.termFields && (
              <div className={formStyles.field}>
                <div className={formStyles.fieldRow}>
                  <div className={formStyles.field}>
                    <label className={formStyles.label} htmlFor="asset-action-term-start">Start date</label>
                    <input
                      id="asset-action-term-start"
                      type="date"
                      className={formStyles.input}
                      value={form.termStart}
                      onChange={(e) => update({ termStart: e.target.value })}
                    />
                  </div>
                  <div className={formStyles.field}>
                    <label className={formStyles.label} htmlFor="asset-action-term-end">End date</label>
                    <input
                      id="asset-action-term-end"
                      type="date"
                      className={formStyles.input}
                      value={form.termEnd}
                      onChange={(e) => update({ termEnd: e.target.value })}
                    />
                  </div>
                </div>
                <p className={formStyles.fieldHint}>
                  Leave blank to renew from each asset's end date for its renewal term. Dates are in {timeZone}.
                </p>
              </div>
            )}

            {action.family === 'swap' &&
              assets.map((asset) => {
                const line = form.swapLines[asset.id]
                return (
                  <div key={asset.id} className={formStyles.swapBlock}>
                    <p className={formStyles.swapHeading}>{asset.name}</p>
                    <div className={formStyles.field}>
                      <span className={formStyles.label}>Replace with</span>
                      <SalesforceLookupInput
                        value={line?.target?.productName ?? ''}
                        onChange={() => undefined}
                        onSelect={(record) => updateSwapLine(asset.id, { target: swapTargetFromRecord(record) })}
                        sObject={TARGET_LOOKUP.sObject}
                        queryFields={TARGET_LOOKUP.queryFields}
                        searchFields={TARGET_LOOKUP.searchFields}
                        valueField={TARGET_LOOKUP.valueField}
                        displayField={TARGET_LOOKUP.displayField}
                        subLabelField={TARGET_LOOKUP.subLabelField}
                        orderBy={TARGET_LOOKUP.orderBy}
                        extraWhere={targetLookupWhere(action, asset, isMultiCurrency)}
                        placeholder="Choose a product"
                        apiVersion={orgInfo.apiVersion}
                      />
                      <p className={formStyles.fieldHint}>
                        {line?.target
                          ? `${line.target.sellingModelName ?? ''} · ${formatMoney(line.target.unitPrice, currency)}`
                          : `Products on the same price book and term, ${TARGET_PRICE_HINTS[action.targetPriceFilter ?? 'any']}.`}
                      </p>
                    </div>
                    <div className={formStyles.fieldRow}>
                      <div className={formStyles.field}>
                        <label className={formStyles.label} htmlFor={`out-${asset.id}`}>Quantity out</label>
                        <input
                          id={`out-${asset.id}`}
                          type="number"
                          min={1}
                          max={asset.quantity ?? undefined}
                          className={formStyles.input}
                          value={line?.outQuantity ?? ''}
                          onChange={(e) => updateSwapLine(asset.id, { outQuantity: Number(e.target.value) })}
                        />
                      </div>
                      <div className={formStyles.field}>
                        <label className={formStyles.label} htmlFor={`in-${asset.id}`}>Quantity in</label>
                        <input
                          id={`in-${asset.id}`}
                          type="number"
                          min={1}
                          className={formStyles.input}
                          value={line?.inQuantity ?? ''}
                          onChange={(e) => updateSwapLine(asset.id, { inQuantity: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
          </fieldset>

          {isIdle && validationError && (
            <div className={styles.warnBanner} role="status">{validationError}</div>
          )}

          {isIdle && (
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button type="button" className={styles.confirmBtn} onClick={handleConfirm} disabled={Boolean(validationError)}>
                Create {form.outputRecordType}
              </button>
            </div>
          )}

          {isLoading && (
            <div className={styles.actions}>
              <button type="button" className={styles.confirmBtn} disabled>
                <span className={styles.spinner} aria-hidden />
                {state.loadingStep ?? 'Working…'}
              </button>
            </div>
          )}

          {isIdle ? (
            <ApiCallDetails
              url={preview.url}
              requestBody={preview.bodies.length > 1 ? preview.bodies : preview.bodies[0]}
              requestLabel="Request Preview"
            />
          ) : (
            <ApiCallDetails url={state.requestUrl} requestBody={state.requestBody} response={state.apiResponse} />
          )}

          <LifecycleStepList steps={state.lifecycleSteps} />

          {state.resultLines.length > 0 && (
            <div className={formStyles.tableWrap}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th className={tableStyles.th}>Line</th>
                    <th className={tableStyles.th}>Action</th>
                    <th className={tableStyles.th}>Qty</th>
                    <th className={tableStyles.th}>Start</th>
                    <th className={tableStyles.th}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {state.resultLines.map((line) => (
                    <tr key={line.id}>
                      <td className={tableStyles.td}>{line.productName}</td>
                      <td className={tableStyles.td}>
                        {line.type ?? '—'}
                        {line.subType && <div className={formStyles.fieldHint}>{line.subType}</div>}
                      </td>
                      <td className={tableStyles.td}>
                        {line.endQuantity != null
                          ? `${line.startQuantity ?? 0} → ${line.endQuantity}`
                          : (line.quantity ?? '—')}
                      </td>
                      <td className={tableStyles.td}>{formatDate(line.startDate)}</td>
                      <td className={tableStyles.td}>
                        {line.totalPrice != null ? formatMoney(line.totalPrice, currency) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
