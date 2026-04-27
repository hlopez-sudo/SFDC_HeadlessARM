import { execFileSync } from 'node:child_process'
import * as https from 'node:https'
import * as http from 'node:http'
import { URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// ---------------------------------------------------------------------------
// Salesforce CLI helpers
// ---------------------------------------------------------------------------

const CLI_AUTH_TTL_MS = 30 * 1000 // 30 s — short enough to pick up org switches quickly

type SfOrgAuth = {
  instanceUrl: string
  accessToken: string
  username: string
  alias: string
  orgId: string
}

type AuthCache = SfOrgAuth & { resolvedAlias: string; at: number; apiVersion: string }

let authCache: AuthCache | null = null

/** Returns the SF target alias: explicit env var → local project config → global CLI default org */
function resolveTargetAlias(envAlias: string): string {
  if (envAlias) return envAlias
  try {
    const out = execFileSync('sf', ['config', 'get', 'target-org', '--json'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    })
    const jsonStart = out.indexOf('{')
    if (jsonStart === -1) return ''
    const parsed = JSON.parse(out.slice(jsonStart)) as {
      result?: { value?: string }[]
    }
    return parsed.result?.[0]?.value?.trim() ?? ''
  } catch {
    return ''
  }
}

function fetchSfOrgAuth(alias: string): SfOrgAuth {
  const args = ['org', 'display', '--json']
  if (alias) args.push('-o', alias)
  const out = execFileSync('sf', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
  const jsonStart = out.indexOf('{')
  if (jsonStart === -1) throw new Error('sf org display: no JSON in output')
  const parsed = JSON.parse(out.slice(jsonStart)) as {
    status: number
    result?: {
      accessToken?: string
      instanceUrl?: string
      username?: string
      alias?: string
      id?: string
    }
  }
  if (parsed.status !== 0 || !parsed.result?.accessToken || !parsed.result?.instanceUrl) {
    throw new Error('sf org display: missing accessToken or instanceUrl')
  }
  return {
    accessToken: parsed.result.accessToken,
    instanceUrl: parsed.result.instanceUrl.replace(/\/$/, ''),
    username: parsed.result.username ?? '',
    alias: parsed.result.alias ?? alias,
    orgId: parsed.result.id ?? '',
  }
}

function getCachedSfOrgAuth(envAlias: string): SfOrgAuth {
  const now = Date.now()
  const alias = resolveTargetAlias(envAlias)
  if (authCache && authCache.resolvedAlias === alias && now - authCache.at < CLI_AUTH_TTL_MS) {
    return authCache
  }
  const auth = fetchSfOrgAuth(alias)
  // apiVersion will be populated by discoverOrgApiVersion; seed with empty for now
  authCache = { ...auth, resolvedAlias: alias, at: now, apiVersion: authCache?.apiVersion ?? '' }
  return authCache
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function httpsGet(
  instanceUrl: string,
  path: string,
  accessToken: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    let target: URL
    try {
      target = new URL(path, instanceUrl)
    } catch {
      reject(new Error('Invalid instance URL'))
      return
    }
    const req = https.request(
      {
        hostname: target.hostname,
        port: target.port ? Number(target.port) : 443,
        path: target.pathname + target.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      },
      (res) => {
        let body = ''
        res.on('data', (c: Buffer) => { body += c.toString() })
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }))
      },
    )
    req.on('error', reject)
    req.setTimeout(6000, () => { req.destroy(); reject(new Error('Connection timed out.')) })
    req.end()
  })
}

/**
 * Hits GET /services/data/ to discover the org's available API versions.
 * Returns the latest version string (e.g. "67.0") and confirms the org is live.
 * Falls back to `fallback` if the org is unreachable or returns no versions.
 */
async function discoverOrgApiVersion(
  auth: SfOrgAuth,
  fallback: string,
): Promise<{ apiVersion: string; connected: boolean; connectionError?: string }> {
  try {
    const { statusCode, body } = await httpsGet(auth.instanceUrl, '/services/data/', auth.accessToken)
    if (statusCode === 200) {
      type VersionEntry = { version?: string; label?: string; url?: string }
      const versions = JSON.parse(body) as VersionEntry[]
      if (Array.isArray(versions) && versions.length > 0) {
        // Versions are returned oldest-first; take the last entry
        const latest = versions[versions.length - 1].version ?? fallback
        // Store in cache so proxy/pricing hook picks it up
        if (authCache) authCache.apiVersion = latest
        return { apiVersion: latest, connected: true }
      }
    }
    // Non-200 — org exists but something is wrong
    let errMsg = `HTTP ${statusCode}`
    try {
      const parsed = JSON.parse(body) as { message?: string }[]
      if (parsed[0]?.message) errMsg = parsed[0].message
    } catch { /* ignore */ }
    return { apiVersion: fallback, connected: false, connectionError: errMsg }
  } catch (e) {
    return { apiVersion: fallback, connected: false, connectionError: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Vite plugin
// ---------------------------------------------------------------------------

function sfConfigPlugin(envAlias: string, fallbackApiVersion: string): Plugin {
  return {
    name: 'sf-config',
    configureServer(server) {

      // GET /api/sf-config/status — org info + live API version discovery
      server.middlewares.use('/api/sf-config', async (req, res, next) => {
        if (req.method !== 'GET' || req.url !== '/status') {
          next()
          return
        }
        try {
          const auth = getCachedSfOrgAuth(envAlias)
          const { apiVersion, connected, connectionError } = await discoverOrgApiVersion(
            auth,
            fallbackApiVersion,
          )
          json(res, 200, {
            connected,
            connectionError: connectionError ?? null,
            instanceUrl: auth.instanceUrl,
            username: auth.username,
            alias: auth.alias,
            orgId: auth.orgId,
            apiVersion,
          })
        } catch (e) {
          json(res, 200, {
            connected: false,
            connectionError: (e as Error).message,
            instanceUrl: '',
            username: '',
            alias: envAlias || '(default)',
            orgId: '',
            apiVersion: fallbackApiVersion,
          })
        }
      })

      // Dynamic reverse-proxy: /api/salesforce/* → Salesforce REST API
      server.middlewares.use('/api/salesforce', (req, res) => {
        let auth: SfOrgAuth
        try {
          auth = getCachedSfOrgAuth(envAlias)
        } catch (e) {
          json(res, 503, {
            error: `Salesforce CLI error: ${(e as Error).message}. Run "sf org login web --set-default".`,
          })
          return
        }

        const sfPath = req.url ?? '/'
        let target: URL
        try {
          target = new URL(sfPath, auth.instanceUrl)
        } catch {
          json(res, 400, { error: 'Could not build Salesforce URL.' })
          return
        }

        const headers: http.OutgoingHttpHeaders = {}
        const skipHeaders = new Set(['host', 'connection', 'authorization'])
        for (const [k, v] of Object.entries(req.headers)) {
          if (!skipHeaders.has(k.toLowerCase())) headers[k] = v
        }
        headers['host'] = target.host
        headers['Authorization'] = `Bearer ${auth.accessToken}`

        const options: https.RequestOptions = {
          hostname: target.hostname,
          port: target.port ? Number(target.port) : 443,
          path: target.pathname + target.search,
          method: req.method,
          headers,
        }

        const proxyReq = https.request(options, (sfRes) => {
          const resHeaders: http.OutgoingHttpHeaders = {}
          for (const [k, v] of Object.entries(sfRes.headers)) {
            if (k.toLowerCase() !== 'transfer-encoding') resHeaders[k] = v
          }
          if (sfRes.statusCode !== 200) {
            let body = ''
            sfRes.on('data', (chunk: Buffer) => { body += chunk.toString() })
            sfRes.on('end', () => {
              res.writeHead(sfRes.statusCode ?? 502, resHeaders)
              res.end(body)
            })
          } else {
            res.writeHead(200, resHeaders)
            sfRes.pipe(res)
          }
        })

        proxyReq.on('error', (err) => {
          if (!res.headersSent) json(res, 502, { error: err.message })
        })

        req.pipe(proxyReq)
      })
    },
  }
}

// ---------------------------------------------------------------------------
// Vite config
// ---------------------------------------------------------------------------

export default defineConfig(() => {
  return {
    // fallbackApiVersion is used only if /services/data/ discovery fails
    plugins: [react(), sfConfigPlugin('', '62.0')],
  }
})
