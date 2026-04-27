import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_HEADLESS_PRICING_CONFIG,
  type HeadlessPricingConfig,
  isHeadlessPricingConfigComplete,
  loadHeadlessPricingConfig,
  saveHeadlessPricingConfig,
} from './headlessPricingConfig'

type HeadlessPricingConfigContextValue = {
  config: HeadlessPricingConfig
  setConfig: (config: HeadlessPricingConfig) => void
  isComplete: boolean
}

const HeadlessPricingConfigContext = createContext<HeadlessPricingConfigContextValue | null>(null)

export function HeadlessPricingConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<HeadlessPricingConfig>(loadHeadlessPricingConfig)

  const setConfig = useCallback((next: HeadlessPricingConfig) => {
    saveHeadlessPricingConfig(next)
    setConfigState(next)
  }, [])

  return (
    <HeadlessPricingConfigContext.Provider
      value={{ config, setConfig, isComplete: isHeadlessPricingConfigComplete(config) }}
    >
      {children}
    </HeadlessPricingConfigContext.Provider>
  )
}

export function useHeadlessPricingConfig(): HeadlessPricingConfigContextValue {
  const ctx = useContext(HeadlessPricingConfigContext)
  if (!ctx) {
    return {
      config: { ...DEFAULT_HEADLESS_PRICING_CONFIG },
      setConfig: () => {},
      isComplete: false,
    }
  }
  return ctx
}
