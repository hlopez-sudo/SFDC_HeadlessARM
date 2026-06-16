import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, LayoutDashboard, Package, Settings, UserPlus } from 'lucide-react'
import { useQuoteCart } from '../../quote/QuoteCartContext'
import { useSiteBranding } from '../../branding/SiteBrandingContext'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const { pathname } = useLocation()
  const { items } = useQuoteCart()
  const { branding } = useSiteBranding()
  const plg = branding.enablePlg
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
            My Account
          </NavLink>

          {!plg && (
            <>
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
            </>
          )}

          {plg && (
            <NavLink
              to="/signup-now"
              className={({ isActive }) =>
                `${styles.row} ${isActive ? styles.rowActive : ''}`
              }
            >
              <span className={styles.iconWrap}>
                <UserPlus size={18} strokeWidth={2} aria-hidden />
              </span>
              Sign Up Now
            </NavLink>
          )}

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
                Read Me
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
              <NavLink
                to="/admin"
                end
                className={({ isActive }) =>
                  `${styles.subItem} ${isActive ? styles.subItemActive : ''}`
                }
              >
                General
              </NavLink>
            </div>
          )}
        </div>
      </nav>
    </aside>
  )
}
