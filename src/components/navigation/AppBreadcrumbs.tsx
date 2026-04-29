import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './AppBreadcrumbs.module.css'

type AppBreadcrumbsProps = {
  /** When set, last crumb is the product name and "Products" links home */
  productName?: string
}

export function AppBreadcrumbs({ productName }: AppBreadcrumbsProps) {
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
        {productName ? (
          <>
            <li className={styles.item}>
              <Link className={styles.link} to="/">
                Products
              </Link>
              <ChevronRight className={styles.sep} size={14} aria-hidden />
            </li>
            <li className={`${styles.item} ${styles.current}`} aria-current="page">
              {productName}
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
