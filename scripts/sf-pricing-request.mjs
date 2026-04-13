#!/usr/bin/env node
/**
 * Salesforce pricing practice script (forticloud-cursor by default).
 *
 * 1) POST Subscription Management "Calculate price" (Buy Now / Pricing API):
 *    POST /services/data/{apiVersion}/commerce/pricing/sales-transactions/actions/calculate-price
 *    Docs: https://developer.salesforce.com/docs/revenue/subscription-management/references/prices
 *    RLM overview: https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/pricing_business_apis.htm
 *
 * 2) If CalculatePrice is not licensed (FUNCTIONALITY_NOT_ENABLED), falls back to a SOQL
 *    query for PricebookEntry list prices (standard Data API).
 *
 * Auth: set SF_INSTANCE_URL + SF_ACCESS_TOKEN, or omit both and pass --target-org
 *       to load credentials via `sf org display --json` (no secrets printed).
 */

import { execSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const DEFAULT_ORG = 'forticloud-cursor'
const DEFAULT_PRODUCT_ID = '01tWt00000CXI9TIAX'
const DEFAULT_API_VERSION = '67.0'

const { values } = parseArgs({
  options: {
    'target-org': { type: 'string', default: process.env.SF_TARGET_ORG ?? DEFAULT_ORG },
    'product-id': { type: 'string', default: process.env.SF_PRODUCT_ID ?? DEFAULT_PRODUCT_ID },
    'api-version': { type: 'string', default: process.env.SF_API_VERSION ?? DEFAULT_API_VERSION },
    'skip-fallback': { type: 'boolean', default: false },
  },
})

function loadAuthFromCli(targetOrg) {
  const raw = execSync(`sf org display --target-org ${JSON.stringify(targetOrg)} --json`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
  const parsed = JSON.parse(raw)
  if (parsed.status !== 0 || !parsed.result?.instanceUrl || !parsed.result?.accessToken) {
    throw new Error('Could not read instanceUrl/accessToken from sf org display --json')
  }
  return {
    instanceUrl: parsed.result.instanceUrl.replace(/\/$/, ''),
    accessToken: parsed.result.accessToken,
  }
}

async function restFetch(instanceUrl, accessToken, path, init = {}) {
  const url = `${instanceUrl}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    ...init.headers,
  }
  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { res, body }
}

/** Sample body — tune per org when CalculatePrice is enabled (see Pricing API reference). */
function buildCalculatePriceBody(productId) {
  return {
    input: {
      currencyIsoCode: 'USD',
      lineItems: [{ product2Id: productId, quantity: 1 }],
    },
  }
}

async function runPricebookFallback(instanceUrl, accessToken, apiVersion, productId) {
  const soql = `SELECT Id, UnitPrice, CurrencyIsoCode, Pricebook2.Name FROM PricebookEntry WHERE Product2Id = '${productId}' AND IsActive = true`
  const q = encodeURIComponent(soql)
  const path = `/services/data/v${apiVersion}/query?q=${q}`
  const { res, body } = await restFetch(instanceUrl, accessToken, path, { method: 'GET' })
  console.log('\n--- Fallback: PricebookEntry (SOQL via REST query) ---')
  console.log(`HTTP ${res.status}`)
  console.log(JSON.stringify(body, null, 2))
}

async function main() {
  const targetOrg = values['target-org']
  const productId = values['product-id']
  const apiVersion = values['api-version']

  let instanceUrl = process.env.SF_INSTANCE_URL?.replace(/\/$/, '')
  let accessToken = process.env.SF_ACCESS_TOKEN

  if (!instanceUrl || !accessToken) {
    console.error(`Loading credentials via Salesforce CLI (org: ${targetOrg})…`)
    const auth = loadAuthFromCli(targetOrg)
    instanceUrl = auth.instanceUrl
    accessToken = auth.accessToken
  }

  const calcPath = `/services/data/v${apiVersion}/commerce/pricing/sales-transactions/actions/calculate-price`
  const bodyJson = buildCalculatePriceBody(productId)

  console.log('--- Calculate price (Subscription Management Pricing API) ---')
  console.log(`POST ${instanceUrl}${calcPath}`)
  console.log('Body:', JSON.stringify(bodyJson))

  const { res, body } = await restFetch(instanceUrl, accessToken, calcPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyJson),
  })

  console.log(`HTTP ${res.status}`)
  console.log(JSON.stringify(body, null, 2))

  const errMsg = Array.isArray(body) ? body[0]?.message : body?.message
  const errCode = Array.isArray(body) ? body[0]?.errorCode : body?.errorCode

  if (
    !values['skip-fallback'] &&
    res.status === 403 &&
    errCode === 'FUNCTIONALITY_NOT_ENABLED' &&
    String(errMsg).includes('CalculatePrice')
  ) {
    console.error(
      '\nNote: CalculatePrice is not enabled for this org/user (Subscription Management pricing).',
    )
    console.error('Running list-price fallback via PricebookEntry SOQL.\n')
    await runPricebookFallback(instanceUrl, accessToken, apiVersion, productId)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
