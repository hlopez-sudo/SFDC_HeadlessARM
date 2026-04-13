import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useCatalog, DEFAULT_CATALOG } from '../catalog/CatalogContext'
import type { CatalogProduct, ProductCatalog } from '../catalog/types'
import styles from './AdminProductCatalogPage.module.css'

function newRow(): CatalogProduct {
  return { id: crypto.randomUUID(), name: '', family: '', description: '', sfProductId: '', imageUrl: '' }
}

export function AdminProductCatalogPage() {
  const { catalog, setCatalog } = useCatalog()
  const [draft, setDraft] = useState<ProductCatalog>(() => structuredClone(catalog))

  useEffect(() => {
    setDraft(structuredClone(catalog))
  }, [catalog])

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(catalog),
    [draft, catalog],
  )

  const onSave = useCallback(() => {
    setCatalog(structuredClone(draft))
  }, [draft, setCatalog])

  const onRevert = useCallback(() => {
    setCatalog(structuredClone(DEFAULT_CATALOG))
  }, [setCatalog])

  const setHeader = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDraft((prev) => ({ ...prev, pageHeader: e.target.value }))
  }, [])

  const setDesc = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft((prev) => ({ ...prev, pageDescription: e.target.value }))
  }, [])

  const updateRow = useCallback(
    (idx: number, field: keyof CatalogProduct, value: string) => {
      setDraft((prev) => {
        const products = prev.products.map((p, i) =>
          i === idx ? { ...p, [field]: value } : p,
        )
        return { ...prev, products }
      })
    },
    [],
  )

  const deleteRow = useCallback((idx: number) => {
    setDraft((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== idx),
    }))
  }, [])

  const addRow = useCallback(() => {
    setDraft((prev) => ({ ...prev, products: [...prev.products, newRow()] }))
  }, [])

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Product Catalog</h1>
      <p className={styles.lead}>
        Configure the products page header, description, and the list of product tiles. Changes are
        saved to this browser when you click Save.
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={!isDirty}
          onClick={onSave}
        >
          Save
        </button>
        <button type="button" className={styles.btn} onClick={onRevert}>
          Revert to Defaults
        </button>
      </div>

      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Product Page Header</legend>
        <div className={styles.field}>
          <input
            className={styles.input}
            type="text"
            autoComplete="off"
            value={draft.pageHeader}
            onChange={setHeader}
          />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Product Page Description</legend>
        <div className={styles.field}>
          <textarea
            className={styles.textarea}
            rows={3}
            value={draft.pageDescription}
            onChange={setDesc}
          />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Products</legend>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colName}>Product Name</th>
                <th className={styles.colFamily}>Product Family</th>
                <th className={styles.colDesc}>Product Description</th>
                <th className={styles.colSfId}>Salesforce ProductID</th>
                <th className={styles.colImage}>Image URL</th>
                <th className={styles.colDel}></th>
              </tr>
            </thead>
            <tbody>
              {draft.products.map((product, idx) => (
                <tr key={product.id}>
                  <td className={styles.colName}>
                    <input
                      className={styles.cellInput}
                      type="text"
                      value={product.name}
                      onChange={(e) => updateRow(idx, 'name', e.target.value)}
                      placeholder="Product name"
                    />
                  </td>
                  <td className={styles.colFamily}>
                    <input
                      className={styles.cellInput}
                      type="text"
                      value={product.family}
                      onChange={(e) => updateRow(idx, 'family', e.target.value)}
                      placeholder="Product family"
                    />
                  </td>
                  <td className={styles.colDesc}>
                    <input
                      className={styles.cellInput}
                      type="text"
                      value={product.description}
                      onChange={(e) => updateRow(idx, 'description', e.target.value)}
                      placeholder="Short description"
                    />
                  </td>
                  <td className={styles.colSfId}>
                    <input
                      className={styles.cellInput}
                      type="text"
                      value={product.sfProductId}
                      onChange={(e) => updateRow(idx, 'sfProductId', e.target.value)}
                      placeholder="Salesforce ID"
                    />
                  </td>
                  <td className={styles.colImage}>
                    <input
                      className={styles.cellInput}
                      type="url"
                      inputMode="url"
                      value={product.imageUrl}
                      onChange={(e) => updateRow(idx, 'imageUrl', e.target.value)}
                      placeholder="https://example.com/image.png"
                    />
                  </td>
                  <td className={styles.colDel}>
                    <button
                      type="button"
                      className={styles.btnIcon}
                      aria-label={`Delete ${product.name || 'row'}`}
                      onClick={() => deleteRow(idx)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className={styles.addRow} onClick={addRow}>
          + Add row
        </button>
      </fieldset>
    </div>
  )
}
