import type { ProductModel } from '../../data/product-models'
import { ProductModelTile } from './ProductModelTile'
import styles from './ProductModelsTileGrid.module.css'

type ProductModelsTileGridProps = {
  models: ProductModel[]
}

export function ProductModelsTileGrid({ models }: ProductModelsTileGridProps) {
  const n = models.length

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {n > 0 ? (
          <span>
            Showing <strong>1–{n}</strong> of <strong>{n}</strong> models
          </span>
        ) : (
          <span>No models in this category.</span>
        )}
      </div>
      <ul className={styles.grid} role="list">
        {models.map((model) => (
          <li key={model.slug} className={styles.item}>
            <ProductModelTile model={model} />
          </li>
        ))}
      </ul>
    </div>
  )
}
