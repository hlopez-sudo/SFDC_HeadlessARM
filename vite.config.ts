import { execFileSync } from 'node:child_process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const CLI_AUTH_TTL_MS = 2 * 60 * 1000

type SfCliAuth = { instanceUrl: string; accessToken: string }

let cliAuthCache: { alias: string } & SfCliAuth & { at: number } | null = null

function getSfOrgAuthFromCli(orgAlias: string): SfCliAuth {
  const out = execFileSync('sf', ['org', 'display', '--json', '-o', orgAlias], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
  const jsonStart = out.indexOf('{')
  if (jsonStart === -1) throw new Error('sf org display: no JSON in output')
  const parsed = JSON.parse(out.slice(jsonStart)) as {
    status: number
    result?: { accessToken?: string; instanceUrl?: string }
  }
  if (parsed.status !== 0 || !parsed.result?.accessToken || !parsed.result?.instanceUrl) {
    throw new Error('sf org display: missing accessToken or instanceUrl')
  }
  return {
    accessToken: parsed.result.accessToken,
    instanceUrl: parsed.result.instanceUrl,
  }
}

function getCachedSfCliAuth(orgAlias: string): SfCliAuth {
  const now = Date.now()
  if (
    cliAuthCache &&
    cliAuthCache.alias === orgAlias &&
    now - cliAuthCache.at < CLI_AUTH_TTL_MS
  ) {
    return {
      instanceUrl: cliAuthCache.instanceUrl,
      accessToken: cliAuthCache.accessToken,
    }
  }
  const a = getSfOrgAuthFromCli(orgAlias)
  cliAuthCache = { alias: orgAlias, ...a, at: now }
  return a
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load .env.local so proxy can read VITE_SF_* variables at config time
  const env = loadEnv(mode, process.cwd(), '')
  // Only resolve tokens via `sf` during dev — avoids requiring CLI on `vite build` / CI
  const sfOrgAlias =
    command === 'serve' && env.VITE_SF_ORG_ALIAS?.trim()
      ? env.VITE_SF_ORG_ALIAS.trim()
      : ''

  let salesforceProxyTarget = env.VITE_SF_INSTANCE_URL ?? 'http://localhost'
  if (sfOrgAlias) {
    try {
      salesforceProxyTarget = getCachedSfCliAuth(sfOrgAlias).instanceUrl
    } catch (e) {
      console.warn(
        '[vite] Could not load Salesforce auth from CLI; using VITE_SF_INSTANCE_URL from .env.',
        (e as Error).message,
      )
    }
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/salesforce': {
          target: salesforceProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/salesforce/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              let token = env.VITE_SF_ACCESS_TOKEN ?? ''
              if (sfOrgAlias) {
                try {
                  token = getCachedSfCliAuth(sfOrgAlias).accessToken
                } catch {
                  token = env.VITE_SF_ACCESS_TOKEN ?? ''
                }
              }
              proxyReq.setHeader('Authorization', `Bearer ${token}`)
            })
          },
        },
      },
    },
  }
})
