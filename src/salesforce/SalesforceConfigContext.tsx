import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_SF_ORG_INFO, type SalesforceOrgInfo } from './types'

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

type SalesforceConfigContextValue = {
  orgInfo: SalesforceOrgInfo
  /** Re-fetch org info from the dev server (which re-reads the CLI). */
  refresh: () => Promise<void>
  loading: boolean
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SalesforceConfigContext = createContext<SalesforceConfigContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SalesforceConfigProvider({ children }: { children: ReactNode }) {
  const [orgInfo, setOrgInfo] = useState<SalesforceOrgInfo>(DEFAULT_SF_ORG_INFO)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sf-config/status')
      if (res.ok) {
        const data = (await res.json()) as SalesforceOrgInfo
        setOrgInfo(data)
      }
    } catch {
      // Endpoint not available (e.g. production build) — stay with defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <SalesforceConfigContext.Provider value={{ orgInfo, refresh, loading }}>
      {children}
    </SalesforceConfigContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSalesforceConfig(): SalesforceConfigContextValue {
  const ctx = useContext(SalesforceConfigContext)
  if (!ctx) {
    return {
      orgInfo: DEFAULT_SF_ORG_INFO,
      refresh: async () => {},
      loading: false,
    }
  }
  return ctx
}
