import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CatalogProvider } from './catalog/CatalogContext'
import { SiteBrandingProvider } from './branding/SiteBrandingContext'
import { SalesforceConfigProvider } from './salesforce/SalesforceConfigContext'
import { HeadlessPricingConfigProvider } from './salesforce/HeadlessPricingConfigContext'
import { QuoteCartProvider } from './quote/QuoteCartContext'
import { OrderCartProvider } from './quote/OrderCartContext'
import { TrialDrawerProvider } from './quote/TrialDrawerContext'
import { BuyNowDrawerProvider } from './quote/BuyNowDrawerContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteBrandingProvider>
      <CatalogProvider>
        <SalesforceConfigProvider>
          <HeadlessPricingConfigProvider>
            <QuoteCartProvider>
              <OrderCartProvider>
                <TrialDrawerProvider>
                  <BuyNowDrawerProvider>
                    <BrowserRouter>
                      <App />
                    </BrowserRouter>
                  </BuyNowDrawerProvider>
                </TrialDrawerProvider>
              </OrderCartProvider>
            </QuoteCartProvider>
          </HeadlessPricingConfigProvider>
        </SalesforceConfigProvider>
      </CatalogProvider>
    </SiteBrandingProvider>
  </StrictMode>,
)
