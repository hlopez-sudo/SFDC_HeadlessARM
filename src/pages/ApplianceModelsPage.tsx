import { useCatalog } from '../catalog/CatalogContext'
import { ProductTile } from '../components/products/ProductTile'
import { AppBreadcrumbs } from '../components/navigation/AppBreadcrumbs'
import styles from './ApplianceModelsPage.module.css'

export function ApplianceModelsPage() {
  const { catalog } = useCatalog()

  return (
    <div className={styles.wrap}>
      <AppBreadcrumbs />

      <header className={styles.header}>
        <h1 className={styles.title}>{catalog.pageHeader}</h1>
        {catalog.pageDescription && (
          <p className={styles.lead}>{catalog.pageDescription}</p>
        )}
      </header>

      <ul className={styles.grid} role="list">
        {catalog.products.map((product) => (
          <li key={product.id} className={styles.gridItem}>
            <ProductTile product={product} />
          </li>
        ))}
        {catalog.products.length === 0 && (
          <li className={styles.empty}>No products in the catalog yet.</li>
        )}
      </ul>
    </div>
  )
}
