import styles from './AdminPage.module.css'

function envString(key: string): string | undefined {
  const v = import.meta.env[key as keyof ImportMetaEnv] as string | undefined
  return v && String(v).trim() !== '' ? String(v) : undefined
}

export function AdminSalesforcePage() {
  const orgAlias = envString('VITE_SF_ORG_ALIAS')
  const instanceUrl = envString('VITE_SF_INSTANCE_URL')

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Salesforce</h1>
      <p className={styles.muted}>
        API requests from this app go through the Vite dev proxy at{' '}
        <code>/api/salesforce</code>, which forwards to your Salesforce instance and attaches
        authorization from your environment or from the Salesforce CLI when{' '}
        <code>VITE_SF_ORG_ALIAS</code> is set. The connected org is fixed at dev-server startup via
        those variables—not chosen inside the browser at runtime.
      </p>
      {(orgAlias || instanceUrl) && (
        <ul className={styles.envList}>
          {orgAlias && (
            <li>
              <code>VITE_SF_ORG_ALIAS</code>: <code>{orgAlias}</code>
            </li>
          )}
          {instanceUrl && (
            <li>
              <code>VITE_SF_INSTANCE_URL</code>: <code>{instanceUrl}</code>
            </li>
          )}
        </ul>
      )}
      {!orgAlias && !instanceUrl && (
        <p className={styles.muted}>
          No <code>VITE_SF_ORG_ALIAS</code> or <code>VITE_SF_INSTANCE_URL</code> is exposed to the
          client build; configure them in <code>.env</code> for local development.
        </p>
      )}
    </div>
  )
}
