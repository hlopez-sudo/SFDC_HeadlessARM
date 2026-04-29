import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AdminGeneralPage } from './pages/AdminGeneralPage'
import { AdminProductCatalogPage } from './pages/AdminProductCatalogPage'
import { AdminReadmePage } from './pages/AdminReadmePage'
import { AdminSalesforcePage } from './pages/AdminSalesforcePage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { ProductsPage } from './pages/ProductsPage'
import { DashboardPage } from './pages/DashboardPage'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<ProductsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin/readme" element={<AdminReadmePage />} />
        <Route path="/admin" element={<AdminGeneralPage />} />
        <Route path="/admin/salesforce" element={<AdminSalesforcePage />} />
        <Route path="/admin/product-catalog" element={<AdminProductCatalogPage />} />
        <Route path="/products/:productSlug" element={<ProductDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
