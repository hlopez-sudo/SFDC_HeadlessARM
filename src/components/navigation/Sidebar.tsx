import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, LayoutDashboard, Package, Settings } from 'lucide-react'
import { useQuoteCart } from '../../quote/QuoteCartContext'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const { pathname } = useLocation()
  const { items } = useQuoteCart()
  const productsPath = pathname === '/' || pathname.startsWith('/products')
  const onAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
  const [administrationOpen, setAdministrationOpen] = useState(onAdminPath)

  useEffect(() => {
    if (onAdminPath) setAdministrationOpen(true)
  }, [onAdminPath])

  return (
    <aside className={styles.aside}>
      <nav className={styles.nav} aria-label="Main navigation">
        <div className={styles.sectionLabel}>GENERAL</div>
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

          <NavLink
            to="/"
            end
            aria-current={productsPath ? 'page' : undefined}
            className={() => `${styles.row} ${productsPath ? styles.rowActive : ''}`}
          >
            <span className={styles.iconWrap}>
              <Package size={18} strokeWidth={2} aria-hidden />
            </span>
            Products
          </NavLink>

          <div className={styles.subList}>
            <NavLink
              to="/quotes"
              className={({ isActive }) =>
                `${styles.subItem} ${isActive ? styles.subItemActive : ''}`
              }
            >
              Quotes
              {items.length > 0 && (
                <span className={styles.cartBadge}>{items.length}</span>
              )}
            </NavLink>
          </div>

          <button
            type="button"
            className={`${styles.row} ${onAdminPath ? styles.rowActive : ''}`}
            onClick={() => setAdministrationOpen((o) => !o)}
            aria-expanded={administrationOpen}
          >
            <span className={styles.iconWrap}>
              <Settings size={18} strokeWidth={2} aria-hidden />
            </span>
            Administration
            {administrationOpen ? (
              <ChevronDown className={styles.chevron} size={16} aria-hidden />
            ) : (
              <ChevronRight className={styles.chevron} size={16} aria-hidden />
            )}
          </button>

          {administrationOpen && (
            <div className={styles.subList}>
              <NavLink
                to="/admin/readme"
                className={({ isActive }) =>
                  `${styles.subItem} ${isActive ? styles.subItemActive : ''}`
                }
              >
                README
              </NavLink>
              <NavLink
                to="/admin"
                end
                className={({ isActive }) =>
                  `${styles.subItem} ${isActive ? styles.subItemActive : ''}`
                }
              >
                General
              </NavLink>
              <NavLink
                to="/admin/salesforce"
                className={({ isActive }) =>
                  `${styles.subItem} ${isActive ? styles.subItemActive : ''}`
                }
              >
                Salesforce
              </NavLink>
              <NavLink
                to="/admin/product-catalog"
                className={({ isActive }) =>
                  `${styles.subItem} ${isActive ? styles.subItemActive : ''}`
                }
              >
                Product Catalog
              </NavLink>
            </div>
          )}
        </div>
      </nav>
    </aside>
  )
}
