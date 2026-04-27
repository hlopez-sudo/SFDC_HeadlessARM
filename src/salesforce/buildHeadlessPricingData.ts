// ---------------------------------------------------------------------------
// buildHeadlessPricingData — constructs the `pricingData` object for the
// runSalesforceHeadlessPricing action.
//
// IMPORTANT: The exact field names and nesting are determined by the context
// definition and context mapping configured in your Salesforce org. The default
// structure below mirrors the Revenue Cloud Developer Guide sample
// (SalesTransaction / SalesTransactionItem). Adjust property names here if your
// mapping uses a different schema.
// ---------------------------------------------------------------------------

export type HeadlessPricingDataParams = {
  product2Id: string
  quantity: number
  productSellingModelId?: string
  currencyIsoCode?: string
  pricebookId?: string
  startDate?: string
}

export function buildHeadlessPricingData(
  params: HeadlessPricingDataParams,
): Record<string, unknown> {
  const {
    product2Id,
    quantity,
    productSellingModelId,
    currencyIsoCode = 'USD',
    pricebookId,
    startDate,
  } = params

  const lineItem: Record<string, unknown> = {
    businessObjectType: 'SalesTransactionItem',
    SalesTransactionItemSource: 'LINE_ITEM1',
    Product: product2Id,
    Quantity: quantity,
  }

  if (productSellingModelId) {
    lineItem.ProductSellingModel = productSellingModelId
  }

  if (startDate) {
    lineItem.StartDate = startDate
  }

  const salesTransaction: Record<string, unknown> = {
    businessObjectType: 'SalesTransaction',
    CurrencyIsoCode: currencyIsoCode,
    SalesTransactionItem: [lineItem],
  }

  if (pricebookId) {
    salesTransaction.Pricebook = pricebookId
  }

  return { SalesTransaction: salesTransaction }
}
