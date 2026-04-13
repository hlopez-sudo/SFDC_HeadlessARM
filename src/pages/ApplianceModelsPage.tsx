import { useState } from 'react'
import { CategorySidebar } from '../components/appliance-models/CategorySidebar'
import { ModelsTileGrid } from '../components/appliance-models/ModelsTileGrid'
import { AppBreadcrumbs } from '../components/navigation/AppBreadcrumbs'
import type { CategoryId } from '../data/appliance-models'
import { getModelsByCategory } from '../data/appliance-models'
import styles from './ApplianceModelsPage.module.css'

export function ApplianceModelsPage() {
  const [categoryId, setCategoryId] = useState<CategoryId>('data-center')
  const models = getModelsByCategory(categoryId)

  return (
    <div className={styles.wrap}>
      <AppBreadcrumbs />

      <header className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleAccent}>Appliance</span> Models and Specifications
        </h1>
        <p className={styles.lead}>
          FortiGate NGFW comes with the widest selection on the market to meet your needs in the data
          center, enterprise campus, small, and branch office. All of our hardware appliances are ISO
          27001 certified giving you assurance they are designed to meet the most demanding threat
          protection performance and energy efficiency requirements so FortiGate can fit seamlessly into
          any environment.
        </p>
        <p className={styles.lead}>
          For additional information, you can compare vendors and learn more about network firewall
          pricing or compare products.
        </p>
      </header>

      <div className={styles.body}>
        <CategorySidebar activeId={categoryId} onSelect={setCategoryId} />
        <div className={styles.main}>
          <ModelsTileGrid models={models} />
        </div>
      </div>
    </div>
  )
}
