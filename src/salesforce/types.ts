export type SalesforceOrgInfo = {
  connected: boolean
  connectionError: string | null
  instanceUrl: string
  username: string
  alias: string
  orgId: string
  apiVersion: string
}

export const DEFAULT_SF_ORG_INFO: SalesforceOrgInfo = {
  connected: false,
  connectionError: null,
  instanceUrl: '',
  username: '',
  alias: '',
  orgId: '',
  apiVersion: '67.0',
}
