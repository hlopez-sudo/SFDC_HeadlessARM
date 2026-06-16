# ARM Headless360

A React + TypeScript + Vite headless demo app for Salesforce Revenue Cloud (RLM). It showcases B2B product browsing, quote creation, direct order placement, and Product-Led Growth (PLG) sign-up flows — all driven live against a connected Salesforce org with no backend of its own.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | v18 or later (v24 used in development) |
| npm | v9 or later |
| Salesforce org | RLM enabled — QuantumBit environment via Storm recommended |

Check your versions:

```bash
node --version
npm --version
```

---

## 1. Clone & Install

```bash
git clone https://github.com/hlopez-sudo/SFDC_HeadlessARM.git
cd SFDC_HeadlessARM
npm install
```

---

## 2. Start the Dev Server

```bash
npm run dev
```

The app runs at **http://localhost:5173**.

No `.env` file is required. Salesforce authentication is handled entirely in-browser via OAuth (PKCE) through a built-in Vite dev-server proxy (`vite.config.ts`). The proxy forwards all `/api/salesforce/*` requests to your connected org using the active session token.

---

## 3. Connect to Salesforce (in-app)

1. Open the app at `http://localhost:5173`
2. Navigate to **Administration → Salesforce**
3. Enter your org login URL — e.g. `https://login.salesforce.com` for production, or your sandbox/scratch org URL
4. Click **Log In** — a new browser tab opens for OAuth approval. After you approve, Salesforce redirects back to the app automatically

> **Port 1717 note:** The OAuth callback server listens on port `1717` — the same redirect URI pre-registered by Salesforce PlatformCLI and the Salesforce VS Code extension. If that port is already occupied, quit the Salesforce CLI (`sf` / `sfdx`) and the VS Code Salesforce extension, then retry.

---

## 4. Configure the App

Once connected, complete the following steps in the Administration section:

### Salesforce
- In **Headless Pricing Configuration**, populate the required fields using the lookup icons
- Click **Revert to Defaults** to auto-populate all fields with the standard QuantumBit / RLM values via SOQL lookup (recommended starting point)
- Select an **Account** to use when creating Quotes, Orders, and Assets

### Product Catalog
- Select the **Product Categories** you want to display in the product browser
- Each category will dynamically surface all active products from your org — no manual product configuration needed

### General
- Optionally configure **Branding** (site name, logo, colors)
- Enable **PLG mode** to show the Sign Up Now page with Trial, Professional, Enterprise, and Custom pricing tiles instead of the standard B2B product browser

---

## 5. Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server (http://localhost:5173) |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across the project |

---

## 6. Troubleshooting

**`npm install` fails**
Ensure Node.js v18 or later is installed. Run `node --version` to check.

**Port 1717 is already in use**
Close the Salesforce CLI and the Salesforce VS Code extension, then click Log In again. Both tools register the same `http://localhost:1717/OauthRedirect` callback URI.

**"No Salesforce session" error in the app**
You must connect via Administration → Salesforce before any API features will work. The app does not cache sessions across server restarts.

**Blank page or module errors after pulling updates**
Delete `node_modules` and reinstall:
```bash
rm -rf node_modules
npm install
```

**TypeScript / build errors**
Run `npm run build` to see the full compiler output. The project requires TypeScript ~6.0 (included in `devDependencies` — no global install needed).

---

## 7. Optional: Environment Variable Auth

As an alternative to the in-app OAuth flow, you can provide credentials via a `.env` file in the project root (not committed to git):

```
VITE_SF_ACCESS_TOKEN=your_access_token
VITE_SF_INSTANCE_URL=https://your-instance.my.salesforce.com
```

The in-app OAuth session always takes priority over env vars when both are present. Env var auth does not persist across server restarts.
