import type { ApplianceModel } from '../../data/appliance-models'
import { ApplianceModelTile } from './ApplianceModelTile'
import styles from './ModelsTileGrid.module.css'

type ModelsTileGridProps = {
  models: ApplianceModel[]
}

export function ModelsTileGrid({ models }: ModelsTileGridProps) {
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
            <ApplianceModelTile model={model} />
          </li>
        ))}
      </ul>
    </div>
  )
}
