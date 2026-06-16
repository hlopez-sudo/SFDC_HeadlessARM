import { useCallback, useMemo, useState } from 'react'
import { useCatalog } from '../catalog/CatalogContext'
import { useProductsByCategories } from '../hooks/useProductsByCategories'
import { ProductTile } from '../components/products/ProductTile'
import { AppBreadcrumbs } from '../components/navigation/AppBreadcrumbs'
import styles from './ProductsPage.module.css'

const CATEGORY_SESSION_KEY = 'fc-selected-categories'

export function ProductsPage() {
  const { catalog } = useCatalog()
  const [viewMode, setViewMode] = useState<'tiles' | 'list'>('tiles')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(CATEGORY_SESSION_KEY)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })

  const toggleCategory = useCallback((id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      try {
        sessionStorage.setItem(CATEGORY_SESSION_KEY, JSON.stringify([...next]))
      } catch { /* ignore quota/private mode */ }
      return next
    })
  }, [])

  const selectedSfIds = useMemo(
    () =>
      catalog.productCategories
        .filter((c) => selectedCategoryIds.has(c.id))
        .map((c) => c.sfId)
        .filter(Boolean),
    [catalog.productCategories, selectedCategoryIds],
  )

  const { products: dynamicProducts, loading, error } = useProductsByCategories(selectedSfIds)

  return (
    <div className={styles.wrap}>
      <AppBreadcrumbs />

      <header className={styles.header}>
        <h1 className={styles.title}>{catalog.pageHeader}</h1>
        {catalog.pageDescription && (
          <p className={styles.lead}>{catalog.pageDescription}</p>
        )}
      </header>

      <div className={styles.body}>
        {catalog.productCategories.length > 0 && (
          <div className={styles.categoryPanel}>
            <p className={styles.categoryLabel}>Product Categories</p>
            <ul className={styles.categoryList} role="list">
              {catalog.productCategories.map((cat) => {
                const active = selectedCategoryIds.has(cat.id)
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      className={`${styles.categoryChip} ${active ? styles.categoryChipActive : ''}`}
                      aria-pressed={active}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      {cat.displayName}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <ul className={`${styles.grid} ${viewMode === 'list' ? styles.gridList : ''}`} role="list">
          <li className={styles.toolbarItem}>
            <div className={styles.toolbar}>
              <p className={styles.resultCount}>{dynamicProducts.length} products</p>
              <div className={styles.viewToggle} role="group" aria-label="Product view mode">
                <button
                  type="button"
                  className={`${styles.viewBtn} ${viewMode === 'tiles' ? styles.viewBtnActive : ''}`}
                  aria-pressed={viewMode === 'tiles'}
                  onClick={() => setViewMode('tiles')}
                >
                  Tiles
                </button>
                <button
                  type="button"
                  className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
                  aria-pressed={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
              </div>
            </div>
          </li>
          {selectedCategoryIds.size === 0 && (
            <li className={styles.empty}>Select a category to browse products.</li>
          )}
          {selectedCategoryIds.size > 0 && loading && (
            <li className={styles.empty}>Loading products…</li>
          )}
          {selectedCategoryIds.size > 0 && error && (
            <li className={styles.empty}>Error: {error}</li>
          )}
          {selectedCategoryIds.size > 0 && !loading && !error && dynamicProducts.length === 0 && (
            <li className={styles.empty}>No products found for the selected categories.</li>
          )}
          {dynamicProducts.map((product) => (
            <li
              key={product.id}
              className={`${styles.gridItem} ${viewMode === 'list' ? styles.gridItemList : ''}`}
            >
              <ProductTile product={product} viewMode={viewMode} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
