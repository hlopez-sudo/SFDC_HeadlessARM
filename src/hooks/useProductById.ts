import { useEffect, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import type { CatalogProduct } from '../catalog/types'
import { productCache } from './useProductsByCategories'

type State =
  | { status: 'loading' }
  | { status: 'found'; product: CatalogProduct }
  | { status: 'not-found' }
  | { status: 'error'; error: string }

export function useProductById(productId: string): State {
  const { orgInfo } = useSalesforceConfig()
  const apiVersion = orgInfo.apiVersion || '62.0'
  const instanceUrl = orgInfo.instanceUrl

  const [state, setState] = useState<State>(() => {
    const cached = productCache.get(productId)
    return cached ? { status: 'found', product: cached } : { status: 'loading' }
  })

  useEffect(() => {
    if (!productId) {
      setState({ status: 'not-found' })
      return
    }

    const cached = productCache.get(productId)
    if (cached) {
      setState({ status: 'found', product: cached })
      return
    }

    setState({ status: 'loading' })
    let cancelled = false

    async function run() {
      const soql = `SELECT Id, Name, Family, Description, DisplayUrl FROM Product2 WHERE Id = '${productId}'`
      const res = await fetch(
        `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(soql)}`,
      )
      if (!res.ok) {
        const body = (await res.json()) as { message?: string }[]
        throw new Error(
          Array.isArray(body) && body[0]?.message ? body[0].message : `HTTP ${res.status}`,
        )
      }
      const data = (await res.json()) as { records: SfProduct2Record[] }
      const raw = data.records?.[0]
      if (!raw) {
        if (!cancelled) setState({ status: 'not-found' })
        return
      }
      const product: CatalogProduct = {
        id: raw.Id,
        sfProductId: raw.Id,
        name: raw.Name,
        family: raw.Family ?? '',
        description: raw.Description ?? '',
        imageUrl: raw.DisplayUrl ? `${instanceUrl}${raw.DisplayUrl}` : '',
      }
      productCache.set(raw.Id, product)
      if (!cancelled) setState({ status: 'found', product })
    }

    run().catch((e: unknown) => {
      if (!cancelled)
        setState({ status: 'error', error: e instanceof Error ? e.message : 'Fetch failed' })
    })

    return () => {
      cancelled = true
    }
  }, [productId, apiVersion, instanceUrl])

  return state
}

type SfProduct2Record = {
  Id: string
  Name: string
  Family: string | null
  Description: string | null
  DisplayUrl: string | null
}
