import * as crypto from 'node:crypto'
import * as https from 'node:https'
import * as http from 'node:http'
import * as querystring from 'node:querystring'
import { URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// ---------------------------------------------------------------------------
// OAuth session store
// ---------------------------------------------------------------------------

type SfOrgAuth = {
  instanceUrl: string
  accessToken: string
  username: string
  alias: string
  orgId: string
}

type OAuthSession = SfOrgAuth & { apiVersion: string; refreshToken?: string }

let oauthSession: OAuthSession | null = null

// Pending PKCE sessions — keyed by sessionId returned to the browser
type PendingSession = {
  codeVerifier: string
  state: string
  loginUrl: string
  status: 'pending' | 'connected' | 'error'
  error?: string
  createdAt: number
}
const pendingSessions = new Map<string, PendingSession>()
const SESSION_TTL_MS = 10 * 60 * 1000

// Ephemeral callback server on port 1717 (the redirect_uri PlatformCLI has registered)
let callbackServer: http.Server | null = null

// ---------------------------------------------------------------------------
// PKCE utilities
// ---------------------------------------------------------------------------

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generateCodeVerifier(): string {
  return base64url(crypto.randomBytes(32))
}

function generateCodeChallenge(verifier: string): string {
  return base64url(crypto.createHash('sha256').update(verifier).digest())
}

// ---------------------------------------------------------------------------
// HTTP helpers
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
    try { target = new URL(path, instanceUrl) } catch { reject(new Error('Invalid URL')); return }
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

function httpsPost(
  url: string,
  body: string,
  contentType: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    let target: URL
    try { target = new URL(url) } catch { reject(new Error('Invalid URL')); return }
    const req = https.request(
      {
        hostname: target.hostname,
        port: target.port ? Number(target.port) : 443,
        path: target.pathname + target.search,
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(body),
          Accept: 'application/json',
        },
      },
      (res) => {
        let buf = ''
        res.on('data', (c: Buffer) => { buf += c.toString() })
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: buf }))
      },
    )
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timed out.')) })
    req.write(body)
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Ephemeral callback server on port 1717
// PlatformCLI has http://localhost:1717/OauthRedirect pre-registered — same
// redirect URI the Salesforce CLI and VS Code Salesforce extension use.
// ---------------------------------------------------------------------------

function startCallbackServer(devPort: number): void {
  if (callbackServer?.listening) return

  callbackServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:1717')

    if (!url.pathname.startsWith('/OauthRedirect')) {
      res.writeHead(404); res.end(); return
    }

    const code = url.searchParams.get('code') ?? ''
    const state = url.searchParams.get('state') ?? ''
    const error = url.searchParams.get('error')
    const errorDesc = url.searchParams.get('error_description')

    // Match callback state to a pending session
    let sessionId: string | undefined
    let session: PendingSession | undefined
    for (const [id, s] of pendingSessions.entries()) {
      if (s.state === state) { sessionId = id; session = s; break }
    }

    if (!session || !sessionId) {
      res.writeHead(400, { 'Content-Type': 'text/html' })
      res.end('<html><body><p>Invalid OAuth state. Close this tab and try again.</p></body></html>')
      stopCallbackServer()
      return
    }

    if (error) {
      session.status = 'error'
      session.error = errorDesc ?? error
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(closingHtml(`Authentication failed: ${session.error}`))
      stopCallbackServer()
      return
    }

    try {
      const formBody = querystring.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.VITE_SF_CLIENT_ID ?? 'PlatformCLI',
        redirect_uri: 'http://localhost:1717/OauthRedirect',
        code_verifier: session.codeVerifier,
      })

      const { statusCode, body } = await httpsPost(
        `${session.loginUrl}/services/oauth2/token`,
        formBody,
        'application/x-www-form-urlencoded',
      )

      type TokenResponse = {
        access_token?: string
        instance_url?: string
        id?: string
        refresh_token?: string
        error?: string
        error_description?: string
      }
      const tokenData = JSON.parse(body) as TokenResponse

      if (statusCode >= 300 || tokenData.error) {
        session.status = 'error'
        session.error = tokenData.error_description ?? tokenData.error ?? `HTTP ${statusCode}`
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(closingHtml(`Token exchange failed: ${session.error}`))
        stopCallbackServer()
        return
      }

      const accessToken = tokenData.access_token ?? ''
      const instanceUrl = (tokenData.instance_url ?? '').replace(/\/$/, '')

      let username = ''
      let orgId = ''
      if (tokenData.id) {
        try {
          const { body: userBody } = await httpsGet(instanceUrl, tokenData.id.replace(instanceUrl, ''), accessToken)
          const userInfo = JSON.parse(userBody) as { username?: string; organization_id?: string }
          username = userInfo.username ?? ''
          orgId = userInfo.organization_id ?? ''
        } catch { /* non-fatal */ }
      }

      oauthSession = {
        accessToken,
        instanceUrl,
        username,
        alias: '',
        orgId,
        apiVersion: '',
        refreshToken: tokenData.refresh_token,
      }

      session.status = 'connected'

      // Redirect the Salesforce tab back to the admin page
      res.writeHead(302, { Location: `http://localhost:${devPort}/admin/salesforce?oauth_success=1` })
      res.end()
    } catch (e) {
      session.status = 'error'
      session.error = (e as Error).message
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(closingHtml(`Error: ${session.error}`))
    }

    stopCallbackServer()
  })

  callbackServer.on('error', (err: NodeJS.ErrnoException) => {
    const msg = err.code === 'EADDRINUSE'
      ? 'Port 1717 is already in use. Close the Salesforce CLI or other app using that port and try again.'
      : err.message
    for (const s of pendingSessions.values()) {
      if (s.status === 'pending') { s.status = 'error'; s.error = msg }
    }
    callbackServer = null
  })

  callbackServer.listen(1717)
}

function stopCallbackServer(): void {
  if (callbackServer) {
    callbackServer.close()
    callbackServer = null
  }
}

function closingHtml(message: string): string {
  return `<!DOCTYPE html><html><head><title>Salesforce Auth</title></head><body>
<p>${message}</p><p>You can close this tab.</p>
<script>setTimeout(() => window.close(), 2000)</script>
</body></html>`
}

// ---------------------------------------------------------------------------
// Active auth — OAuth session takes priority, env vars as fallback
// ---------------------------------------------------------------------------

function getActiveAuth(): OAuthSession {
  if (oauthSession) return oauthSession
  const token = process.env.VITE_SF_ACCESS_TOKEN
  const url = process.env.VITE_SF_INSTANCE_URL
  if (token && url) {
    return {
      accessToken: token,
      instanceUrl: url.replace(/\/$/, ''),
      username: process.env.VITE_SF_USERNAME ?? '',
      alias: process.env.VITE_SF_ORG_ALIAS ?? '',
      orgId: '',
      apiVersion: '62.0',
    }
  }
  throw new Error('No Salesforce session. Connect via the admin UI.')
}

async function discoverOrgApiVersion(
  auth: SfOrgAuth,
  fallback: string,
): Promise<{ apiVersion: string; connected: boolean; connectionError?: string }> {
  try {
    const { statusCode, body } = await httpsGet(auth.instanceUrl, '/services/data/', auth.accessToken)
    if (statusCode === 401) {
      return { apiVersion: fallback, connected: false, connectionError: 'Session expired. Reconnect via the admin UI.' }
    }
    if (statusCode === 200) {
      type VersionEntry = { version?: string }
      const versions = JSON.parse(body) as VersionEntry[]
      if (Array.isArray(versions) && versions.length > 0) {
        const latest = versions[versions.length - 1].version ?? fallback
        if (oauthSession) oauthSession.apiVersion = latest
        return { apiVersion: latest, connected: true }
      }
    }
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

function sfConfigPlugin(fallbackApiVersion: string): Plugin {
  let devPort = 5173
  return {
    name: 'sf-config',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address()
        if (addr && typeof addr === 'object') devPort = addr.port
      })

      // /api/sf-config/* — OAuth + status
      server.middlewares.use('/api/sf-config', async (req, res, next) => {
        const url = req.url ?? ''

        // GET /oauth/init?loginUrl=... — start PKCE flow, open port 1717 callback server
        if (req.method === 'GET' && url.startsWith('/oauth/init')) {
          const params = new URL(url, 'http://localhost').searchParams
          const loginUrl = params.get('loginUrl') ?? ''

          if (!loginUrl.startsWith('https://')) {
            json(res, 400, { error: 'A valid https loginUrl is required.' })
            return
          }

          // Prune expired sessions
          const now = Date.now()
          for (const [id, s] of pendingSessions.entries()) {
            if (now - s.createdAt > SESSION_TTL_MS) pendingSessions.delete(id)
          }

          const sessionId = crypto.randomUUID()
          const state = crypto.randomUUID()
          const codeVerifier = generateCodeVerifier()
          const codeChallenge = generateCodeChallenge(codeVerifier)

          pendingSessions.set(sessionId, {
            codeVerifier,
            state,
            loginUrl,
            status: 'pending',
            createdAt: now,
          })

          startCallbackServer(devPort)

          const authUrl = new URL(`${loginUrl}/services/oauth2/authorize`)
          authUrl.searchParams.set('response_type', 'code')
          authUrl.searchParams.set('client_id', process.env.VITE_SF_CLIENT_ID ?? 'PlatformCLI')
          authUrl.searchParams.set('redirect_uri', 'http://localhost:1717/OauthRedirect')
          authUrl.searchParams.set('code_challenge', codeChallenge)
          authUrl.searchParams.set('code_challenge_method', 'S256')
          authUrl.searchParams.set('state', state)
          authUrl.searchParams.set('prompt', 'login')

          json(res, 200, { sessionId, authUrl: authUrl.toString() })
          return
        }

        // GET /oauth/poll?sessionId=... — check if user has approved in Salesforce
        if (req.method === 'GET' && url.startsWith('/oauth/poll')) {
          const params = new URL(url, 'http://localhost').searchParams
          const sessionId = params.get('sessionId') ?? ''
          const session = pendingSessions.get(sessionId)

          if (!session) {
            json(res, 200, { status: 'expired' })
            return
          }
          if (Date.now() - session.createdAt > SESSION_TTL_MS) {
            pendingSessions.delete(sessionId)
            json(res, 200, { status: 'expired' })
            return
          }
          if (session.status === 'connected') {
            pendingSessions.delete(sessionId)
            json(res, 200, { status: 'connected' })
            return
          }
          if (session.status === 'error') {
            const msg = session.error
            pendingSessions.delete(sessionId)
            json(res, 200, { status: 'error', message: msg })
            return
          }
          json(res, 200, { status: 'pending' })
          return
        }

        // POST /logout
        if (req.method === 'POST' && url === '/logout') {
          oauthSession = null
          json(res, 200, { ok: true })
          return
        }

        // GET /status
        if (req.method === 'GET' && url === '/status') {
          try {
            const auth = getActiveAuth()
            const { apiVersion, connected, connectionError } = await discoverOrgApiVersion(auth, fallbackApiVersion)
            json(res, 200, {
              connected,
              connectionError: connectionError ?? null,
              instanceUrl: auth.instanceUrl,
              username: auth.username,
              alias: auth.alias,
              orgId: auth.orgId,
              apiVersion,
              isOAuthConnected: oauthSession !== null,
            })
          } catch (e) {
            json(res, 200, {
              connected: false,
              connectionError: (e as Error).message,
              instanceUrl: '',
              username: '',
              alias: '',
              orgId: '',
              apiVersion: fallbackApiVersion,
              isOAuthConnected: false,
            })
          }
          return
        }

        next()
      })

      // Dynamic reverse-proxy: /api/salesforce/* → Salesforce REST API
      server.middlewares.use('/api/salesforce', (req, res) => {
        let auth: OAuthSession
        try {
          auth = getActiveAuth()
        } catch (e) {
          json(res, 503, { error: `No Salesforce session: ${(e as Error).message}` })
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
        const skipHeaders = new Set(['host', 'connection', 'authorization', 'accept-encoding'])
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
            const chunks: Buffer[] = []
            sfRes.on('data', (chunk: Buffer) => { chunks.push(chunk) })
            sfRes.on('error', (err) => {
              if (!res.headersSent) res.writeHead(502)
              res.end()
              console.error('[sf-proxy] sfRes stream error:', err.message)
            })
            sfRes.on('end', () => {
              res.writeHead(sfRes.statusCode ?? 502, resHeaders)
              res.end(Buffer.concat(chunks))
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
    plugins: [react(), sfConfigPlugin('62.0')],
  }
})
