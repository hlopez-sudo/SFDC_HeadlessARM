import { useEffect, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import type { SellingModelOption } from './useProductSellingModels'

export function useProductSellingModelOptions(product2Id: string): SellingModelOption[] {
  const { orgInfo } = useSalesforceConfig()
  const apiVersion = orgInfo.apiVersion || '62.0'
  const [options, setOptions] = useState<SellingModelOption[]>([])

  useEffect(() => {
    if (!product2Id) {
      setOptions([])
      return
    }

    let cancelled = false

    async function run() {
      const soql =
        `SELECT Id, Product2.Name, Product2Id, ProductSellingModel.Name, ProductSellingModelId ` +
        `FROM ProductSellingModelOption WHERE Product2Id = '${product2Id}'`
      const res = await fetch(
        `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(soql)}`,
      )
      if (!res.ok || cancelled) return
      const data = (await res.json()) as { records: SfRecord[] }
      if (!cancelled) {
        setOptions(
          (data.records ?? []).map((r) => ({
            id: r.ProductSellingModelId,
            name: r.ProductSellingModel.Name,
          })),
        )
      }
    }

    run().catch(() => { /* stay empty on error */ })
    return () => { cancelled = true }
  }, [product2Id, apiVersion])

  return options
}

type SfRecord = {
  Id: string
  Product2Id: string
  ProductSellingModelId: string
  ProductSellingModel: { Name: string }
  Product2: { Name: string }
}
