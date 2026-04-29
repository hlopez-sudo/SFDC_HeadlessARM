import styles from './DashboardPage.module.css'

/** Placeholder so sidebar “Dashboard” can navigate without conflicting with product routes */
export function DashboardPage() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.muted}>Overview content can be added here.</p>
    </div>
  )
}
