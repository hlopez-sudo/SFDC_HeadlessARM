import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useCatalog } from '../catalog/CatalogContext'
import type { CatalogProduct, ProductCatalog, ProductCategoryEntry, SellingModelEntry } from '../catalog/types'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import { SalesforceLookupInput } from '../components/salesforce/SalesforceLookupInput'
import styles from './AdminProductCatalogPage.module.css'

function newRow(): CatalogProduct {
  return { id: crypto.randomUUID(), name: '', family: '', description: '', sfProductId: '', imageUrl: 'https://www.salesforce.com/news/wp-content/uploads/sites/3/2021/05/Salesforce-logo.jpg?w=2048&h=1152' }
}

function newProductCategoryRow(): ProductCategoryEntry {
  return { id: crypto.randomUUID(), displayName: '', sfId: '' }
}

function newSellingModelRow(): SellingModelEntry {
  return { id: crypto.randomUUID(), displayName: '', sfId: '' }
}

export function AdminProductCatalogPage() {
  const { catalog, setCatalog } = useCatalog()
  const { orgInfo } = useSalesforceConfig()
  const apiVersion = orgInfo.apiVersion || '62.0'
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

  const selectSellingModelOption = useCallback(
    (idx: number, rec: Record<string, unknown>) => {
      setDraft((prev) => {
        const sellingModels = prev.sellingModels.map((m, i) =>
          i === idx ? { ...m, sfId: (rec['Id'] as string) ?? m.sfId } : m,
        )
        return { ...prev, sellingModels }
      })
    },
    [],
  )

  const selectProduct2 = useCallback(
    (idx: number, rec: Record<string, unknown>) => {
      setDraft((prev) => {
        const products = prev.products.map((p, i) =>
          i === idx
            ? {
                ...p,
                name: (rec['Name'] as string) ?? p.name,
                family: (rec['Family'] as string) ?? p.family,
                sfProductId: (rec['Id'] as string) ?? p.sfProductId,
              }
            : p,
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

  const updateSellingModel = useCallback(
    (idx: number, field: keyof SellingModelEntry, value: string) => {
      setDraft((prev) => {
        const sellingModels = prev.sellingModels.map((m, i) =>
          i === idx ? { ...m, [field]: value } : m,
        )
        return { ...prev, sellingModels }
      })
    },
    [],
  )

  const deleteSellingModel = useCallback((idx: number) => {
    setDraft((prev) => ({
      ...prev,
      sellingModels: prev.sellingModels.filter((_, i) => i !== idx),
    }))
  }, [])

  const addSellingModel = useCallback(() => {
    setDraft((prev) => ({ ...prev, sellingModels: [...prev.sellingModels, newSellingModelRow()] }))
  }, [])

  const updateProductCategory = useCallback(
    (idx: number, field: keyof ProductCategoryEntry, value: string) => {
      setDraft((prev) => {
        const productCategories = prev.productCategories.map((c, i) =>
          i === idx ? { ...c, [field]: value } : c,
        )
        return { ...prev, productCategories }
      })
    },
    [],
  )

  const selectProductCategoryOption = useCallback(
    (idx: number, rec: Record<string, unknown>) => {
      setDraft((prev) => {
        const productCategories = prev.productCategories.map((c, i) =>
          i === idx ? { ...c, sfId: (rec['Id'] as string) ?? c.sfId } : c,
        )
        return { ...prev, productCategories }
      })
    },
    [],
  )

  const deleteProductCategory = useCallback((idx: number) => {
    setDraft((prev) => ({
      ...prev,
      productCategories: prev.productCategories.filter((_, i) => i !== idx),
    }))
  }, [])

  const addProductCategory = useCallback(() => {
    setDraft((prev) => ({ ...prev, productCategories: [...prev.productCategories, newProductCategoryRow()] }))
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
        <legend className={styles.sectionTitle}>Product Category</legend>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colDisplayName}>Display Name</th>
                <th className={styles.colSfModelId}>ID</th>
                <th className={styles.colDel}></th>
              </tr>
            </thead>
            <tbody>
              {draft.productCategories.map((cat, idx) => (
                <tr key={cat.id}>
                  <td className={styles.colDisplayName}>
                    <SalesforceLookupInput
                      value={cat.displayName}
                      onChange={(v) => updateProductCategory(idx, 'displayName', v)}
                      onSelect={(rec) => selectProductCategoryOption(idx, rec)}
                      sObject="ProductCategory"
                      queryFields={['Id', 'Name']}
                      searchFields={['Name']}
                      valueField="Name"
                      displayField="Name"
                      subLabelField="Id"
                      orderBy="Name ASC"
                      placeholder="e.g. Hardware"
                      apiVersion={apiVersion}
                    />
                  </td>
                  <td className={styles.colSfModelId}>
                    <input
                      className={styles.cellInput}
                      type="text"
                      value={cat.sfId}
                      onChange={(e) => updateProductCategory(idx, 'sfId', e.target.value)}
                      placeholder="Salesforce ID"
                    />
                  </td>
                  <td className={styles.colDel}>
                    <button
                      type="button"
                      className={styles.btnIcon}
                      aria-label={`Delete ${cat.displayName || 'row'}`}
                      onClick={() => deleteProductCategory(idx)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className={styles.addRow} onClick={addProductCategory}>
          + Add row
        </button>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Product Selling Models — Deprecated: Options are now dynamically populated on the Product Detail page by querying: SELECT Id, Product2.Name, Product2Id, ProductSellingModel.Name, ProductSellingModelId FROM ProductSellingModelOption WHERE Product2Id = &#123;Product2Id&#125;</legend>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colDisplayName}>Display Name</th>
                <th className={styles.colSfModelId}>ID</th>
                <th className={styles.colDel}></th>
              </tr>
            </thead>
            <tbody>
              {draft.sellingModels.map((model, idx) => (
                <tr key={model.id}>
                  <td className={styles.colDisplayName}>
                    <SalesforceLookupInput
                      value={model.displayName}
                      onChange={(v) => updateSellingModel(idx, 'displayName', v)}
                      onSelect={(rec) => selectSellingModelOption(idx, rec)}
                      sObject="ProductSellingModel"
                      queryFields={['Id', 'Name']}
                      searchFields={['Name']}
                      valueField="Name"
                      displayField="Name"
                      subLabelField="Id"
                      orderBy="Name ASC"
                      placeholder="e.g. One-Time"
                      apiVersion={apiVersion}
                    />
                  </td>
                  <td className={styles.colSfModelId}>
                    <input
                      className={styles.cellInput}
                      type="text"
                      value={model.sfId}
                      onChange={(e) => updateSellingModel(idx, 'sfId', e.target.value)}
                      placeholder="Salesforce ID"
                    />
                  </td>
                  <td className={styles.colDel}>
                    <button
                      type="button"
                      className={styles.btnIcon}
                      aria-label={`Delete ${model.displayName || 'row'}`}
                      onClick={() => deleteSellingModel(idx)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className={styles.addRow} onClick={addSellingModel}>
          + Add row
        </button>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Products — Deprecated: Products are now dynamically populated on the Product Search page based on the Category selected by querying: SELECT ProductCategoryId, ProductId, Product.Name, Product.DisplayUrl FROM ProductCategoryProduct WHERE ProductCategoryId = &#123;ProductCategoryId&#125;</legend>
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
                    <SalesforceLookupInput
                      value={product.name}
                      onChange={(v) => updateRow(idx, 'name', v)}
                      onSelect={(rec) => selectProduct2(idx, rec)}
                      sObject="Product2"
                      queryFields={['Id', 'Name', 'Family']}
                      searchFields={['Name']}
                      valueField="Name"
                      displayField="Name"
                      subLabelField="Family"
                      extraWhere="IsActive = true"
                      orderBy="Name ASC"
                      placeholder="Product name"
                      apiVersion={apiVersion}
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
