import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './AppBreadcrumbs.module.css'

type AppBreadcrumbsProps = {
  /** When set, last crumb is the model name and "Products" links home */
  modelName?: string
}

export function AppBreadcrumbs({ modelName }: AppBreadcrumbsProps) {
  return (
    <nav className={styles.nav} aria-label="Breadcrumb">
      <ol className={styles.list}>
        <li className={styles.item}>
          <Link className={styles.link} to="/">
            Home
          </Link>
          <ChevronRight className={styles.sep} size={14} aria-hidden />
        </li>
        <li className={styles.item}>
          <span>Products</span>
          <ChevronRight className={styles.sep} size={14} aria-hidden />
        </li>
        {modelName ? (
          <>
            <li className={styles.item}>
              <Link className={styles.link} to="/">
                Products
              </Link>
              <ChevronRight className={styles.sep} size={14} aria-hidden />
            </li>
            <li className={`${styles.item} ${styles.current}`} aria-current="page">
              {modelName}
            </li>
          </>
        ) : (
          <li className={`${styles.item} ${styles.current}`} aria-current="page">
            Products
          </li>
        )}
      </ol>
    </nav>
  )
}
