import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ApplianceModelDetailPage } from './pages/ApplianceModelDetailPage'
import { ApplianceModelsPage } from './pages/ApplianceModelsPage'
import { DashboardPage } from './pages/DashboardPage'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<ApplianceModelsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/appliance-models/:modelSlug" element={<ApplianceModelDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
