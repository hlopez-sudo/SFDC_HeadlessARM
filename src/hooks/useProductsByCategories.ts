import { useEffect, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import type { CatalogProduct } from '../catalog/types'

const categoryCache = new Map<string, CatalogProduct[]>()
export const productCache = new Map<string, CatalogProduct>()

type State = {
  products: CatalogProduct[]
  loading: boolean
  error: string | null
}

export function useProductsByCategories(sfCategoryIds: string[]): State {
  const { orgInfo } = useSalesforceConfig()
  const apiVersion = orgInfo.apiVersion || '62.0'
  const instanceUrl = orgInfo.instanceUrl
  const [state, setState] = useState<State>({ products: [], loading: false, error: null })

  const key = sfCategoryIds.join(',')

  useEffect(() => {
    if (sfCategoryIds.length === 0) {
      setState({ products: [], loading: false, error: null })
      return
    }

    const uncached = sfCategoryIds.filter((id) => !categoryCache.has(id))

    if (uncached.length === 0) {
      setState({ products: mergeAndDedupe(sfCategoryIds), loading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))
    let cancelled = false

    Promise.all(
      uncached.map(async (sfId) => {
        const soql =
          `SELECT ProductCategoryId, ProductId, Product.Name, Product.DisplayUrl ` +
          `FROM ProductCategoryProduct WHERE ProductCategoryId = '${sfId}'`
        const res = await fetch(
          `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(soql)}`,
        )
        if (!res.ok) {
          const body = (await res.json()) as { message?: string }[]
          throw new Error(
            Array.isArray(body) && body[0]?.message ? body[0].message : `HTTP ${res.status}`,
          )
        }
        const data = (await res.json()) as { records: SfRecord[] }
        const products = (data.records ?? []).map((r) => recordToProduct(r, instanceUrl))
        categoryCache.set(sfId, products)
        products.forEach((p) => productCache.set(p.sfProductId, p))
      }),
    )
      .then(() => {
        if (!cancelled) {
          setState({ products: mergeAndDedupe(sfCategoryIds), loading: false, error: null })
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: e instanceof Error ? e.message : 'Fetch failed',
          }))
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, apiVersion, instanceUrl])

  return state
}

type SfRecord = {
  ProductCategoryId: string
  ProductId: string
  Product: {
    Name: string
    DisplayUrl: string | null
  }
}

function recordToProduct(r: SfRecord, instanceUrl: string): CatalogProduct {
  return {
    id: r.ProductId,
    sfProductId: r.ProductId,
    name: r.Product.Name,
    family: '',
    description: '',
    imageUrl: r.Product.DisplayUrl ? `${instanceUrl}${r.Product.DisplayUrl}` : '',
  }
}

function mergeAndDedupe(sfCategoryIds: string[]): CatalogProduct[] {
  const seen = new Set<string>()
  const result: CatalogProduct[] = []
  for (const id of sfCategoryIds) {
    for (const p of categoryCache.get(id) ?? []) {
      if (!seen.has(p.sfProductId)) {
        seen.add(p.sfProductId)
        result.push(p)
      }
    }
  }
  return result
}
