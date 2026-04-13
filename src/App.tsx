import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AdminGeneralPage } from './pages/AdminGeneralPage'
import { AdminProductCatalogPage } from './pages/AdminProductCatalogPage'
import { AdminSalesforcePage } from './pages/AdminSalesforcePage'
import { ApplianceModelDetailPage } from './pages/ApplianceModelDetailPage'
import { ApplianceModelsPage } from './pages/ApplianceModelsPage'
import { DashboardPage } from './pages/DashboardPage'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<ApplianceModelsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin" element={<AdminGeneralPage />} />
        <Route path="/admin/salesforce" element={<AdminSalesforcePage />} />
        <Route path="/admin/product-catalog" element={<AdminProductCatalogPage />} />
        <Route path="/appliance-models/:modelSlug" element={<ApplianceModelDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
