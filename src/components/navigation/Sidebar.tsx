import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileText,
  LayoutDashboard,
  List,
  MoreHorizontal,
  Package,
  ShoppingBag,
  User,
} from 'lucide-react'
import styles from './Sidebar.module.css'

type ActiveKey =
  | 'dashboard'
  | 'appliance-models'
  | 'my-assets'
  | 'more-views'
  | 'marketplace-general'
  | 'marketplace-spending'
  | 'marketplace-history'
  | 'asset-transfer'
  | 'document-library'

export function Sidebar() {
  const { pathname } = useLocation()
  const [productsOpen, setProductsOpen] = useState(true)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [active, setActive] = useState<ActiveKey>('appliance-models')

  const applianceModelsPath =
    pathname === '/' || pathname.startsWith('/appliance-models')

  return (
    <aside className={styles.aside}>
      <nav className={styles.nav} aria-label="Asset management">
        <div className={styles.sectionLabel}>ASSET MANAGEMENT</div>
        <div className={styles.group}>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `${styles.row} ${isActive ? styles.rowActive : ''}`
            }
          >
            <span className={styles.iconWrap}>
              <LayoutDashboard size={18} strokeWidth={2} aria-hidden />
            </span>
            Dashboard
          </NavLink>

          <button
            type="button"
            className={`${styles.row} ${
              applianceModelsPath ||
              ['my-assets', 'more-views'].includes(active)
                ? styles.rowActive
                : ''
            }`}
            onClick={() => setProductsOpen((o) => !o)}
            aria-expanded={productsOpen}
          >
            <span className={styles.iconWrap}>
              <Package size={18} strokeWidth={2} aria-hidden />
            </span>
            Products
            {productsOpen ? (
              <ChevronDown className={styles.chevron} size={16} aria-hidden />
            ) : (
              <ChevronRight className={styles.chevron} size={16} aria-hidden />
            )}
          </button>

          {productsOpen && (
            <div className={styles.subList}>
              <Link
                to="/"
                className={`${styles.subItem} ${applianceModelsPath ? styles.subItemActive : ''}`}
              >
                <List size={15} strokeWidth={2} aria-hidden />
                Appliance Models
              </Link>
              <button
                type="button"
                className={`${styles.subItem} ${active === 'my-assets' ? styles.subItemActive : ''}`}
                onClick={() => setActive('my-assets')}
              >
                <User size={15} strokeWidth={2} aria-hidden />
                My Assets
              </button>
              <button
                type="button"
                className={`${styles.subItem} ${active === 'more-views' ? styles.subItemActive : ''}`}
                onClick={() => setActive('more-views')}
              >
                <MoreHorizontal size={15} strokeWidth={2} aria-hidden />
                More Views
              </button>
            </div>
          )}

          <button
            type="button"
            className={`${styles.row} ${
              [
                'marketplace-general',
                'marketplace-spending',
                'marketplace-history',
              ].includes(active)
                ? styles.rowActive
                : ''
            }`}
            onClick={() => setMarketplaceOpen((o) => !o)}
            aria-expanded={marketplaceOpen}
          >
            <span className={styles.iconWrap}>
              <ShoppingBag size={18} strokeWidth={2} aria-hidden />
            </span>
            Marketplace
            {marketplaceOpen ? (
              <ChevronDown className={styles.chevron} size={16} aria-hidden />
            ) : (
              <ChevronRight className={styles.chevron} size={16} aria-hidden />
            )}
          </button>

          {marketplaceOpen && (
            <div className={styles.subList}>
              <button
                type="button"
                className={`${styles.subItem} ${active === 'marketplace-general' ? styles.subItemActive : ''}`}
                onClick={() => setActive('marketplace-general')}
              >
                General
              </button>
              <button
                type="button"
                className={`${styles.subItem} ${active === 'marketplace-spending' ? styles.subItemActive : ''}`}
                onClick={() => setActive('marketplace-spending')}
              >
                <BarChart3 size={15} strokeWidth={2} aria-hidden />
                Spending
              </button>
              <button
                type="button"
                className={`${styles.subItem} ${active === 'marketplace-history' ? styles.subItemActive : ''}`}
                onClick={() => setActive('marketplace-history')}
              >
                History
              </button>
            </div>
          )}

          <button
            type="button"
            className={`${styles.row} ${active === 'asset-transfer' ? styles.rowActive : ''}`}
            onClick={() => setActive('asset-transfer')}
          >
            <span className={styles.iconWrap}>
              <ArrowLeftRight size={18} strokeWidth={2} aria-hidden />
            </span>
            Asset Transfer
          </button>
        </div>

        <div className={styles.bottom}>
          <button
            type="button"
            className={`${styles.row} ${active === 'document-library' ? styles.rowActive : ''}`}
            onClick={() => setActive('document-library')}
          >
            <span className={styles.iconWrap}>
              <FileText size={18} strokeWidth={2} aria-hidden />
            </span>
            Document Library
          </button>
        </div>
      </nav>
    </aside>
  )
}
