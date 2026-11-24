# Development and configuration

## Quick start

Use Node.js 24, matching Docker and GitHub Actions. No framework build step is required; the Node HTTP server serves `public/` directly.

```sh
npm ci --ignore-scripts
cp .env.example .env
chmod 600 .env
# Edit .env locally to supply credentials.
npm test
node --env-file=.env server.mjs
```

Open http://localhost:3000. `npm start` does not load `.env` automatically: export the variables first or use the explicit Node command above. Keys may be absent when checking navigation and validation; live rail or AI requests then report that the corresponding service is unavailable. An empty admin token disables admin access.

The example binds direct Node to loopback. Compose uses the application's default container bind address and publishes the Pi app only at `127.0.0.1:3090`. Changing `HOST` or `PORT` in `.env` does not change Compose's application settings unless explicitly forwarded in its configuration.

## Environment reference

| Variable | Purpose and default |
| --- | --- |
| `RAILKIT_API_KEY` | Server-only RailKit credential; required for live rail queries |
| `GEMINI_API_KEY` | Server-only Gemini credential; required for the AI endpoint |
| `GEMINI_MODEL` | Primary model; `gemini-3.5-flash-lite` |
| `GEMINI_FALLBACK_MODEL` | Bounded model fallback; `gemini-3.5-flash` |
| `ADMIN_TOKEN` | Bearer token of at least 24 characters; unset/short values disable admin access |
| `AI_DAILY_LIMIT` | Positive daily model-attempt allowance; default `200`, counted by IST date. `0` falls back to the default and does not disable AI |
| `AFFILIATE_ALLOWED_HOSTS` | Optional comma-separated exact affiliate network hosts, in addition to each provider's configured host |
| `PAYMENTS_ENABLED` | Literal `true` enables provider checkout when all Razorpay credentials are present; default false |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Server-side merchant credentials; test/live mode follows key ID |
| `RAZORPAY_WEBHOOK_SECRET` | Separate secret matching the merchant dashboard webhook configuration |
| `HOSTINGER_API_KEY` | Pi certificate tooling maps it to acme.sh's `HOSTINGER_Token`; not passed to the web app |
| `DATA_DIR` | SQLite directory; unset means in-memory storage. Pi Compose sets `/app/data` on a persistent volume |
| `PORT` | Direct Node HTTP port; default `3000` |
| `HOST` | Direct Node listen address; default `0.0.0.0` |
| `TRUST_PROXY` | Only literal `true` enables forwarded-address use for AI and commerce limits; use behind the trusted proxy, not an exposed Node port |

Generate an admin token locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and store it only in `.env` or a secret manager. Never add credentials to frontend files, request URLs, examples or commits.

## Source map

| Location | Responsibility |
| --- | --- |
| `server.mjs` | HTTP routing, static assets, security headers and public rail limiter |
| `railkit.mjs` | Fifteen validated SDK operations, deadline and sanitized provider errors |
| `public/services.js` | Shared rail catalog, field schemas and IST validation |
| `public/app.js`, `public/style.css` | Responsive navigation, forms and result rendering |
| `assistant.mjs`, `public/assistant-ui.js` | Gemini orchestration and in-memory chat UI |
| `rail-mcp.mjs`, `mcp-stdio.mjs` | MCP tools, in-process bridge and stdio entrypoint |
| `payments.mjs`, `public/wallet.js` | Optional hosted payment requests and verified statuses |
| `commerce.mjs`, `storage.mjs` | Referrals, admin operations, enquiries and SQLite |
| `public/bookings.js`, `public/growth-ui.js` | Provider catalog, disclosures and saved shortcuts |
| `test/` | Node test runner suites, including jsdom UI interaction tests |
| `deploy/`, `.github/workflows/` | Deployment, TLS maintenance and CI/CD |

## Verification and contributions

Run `npm test` after behavior changes. Tests use mocks and local fixtures; passing tests do not verify provider credentials, upstream availability, browser layout or ticket booking. The suite currently contains 50 tests. For UI changes, additionally check narrow and wide viewports, keyboard navigation, dialogs, result overflow and the service worker update path in a real browser when available.

Increment the cache name in `public/sw.js` when changing cached shell assets. Never add API responses, PNRs, chat or external provider pages to the service-worker cache.

Add rail operations through the shared schema and SDK dispatch mapping, then cover validation, argument order and failure behavior. Verify actual installed SDK exports before adding features described by newer upstream documentation. Tests should not call live providers or consume production quota.

Use feature branches and pull requests once the remote repository is available. Main-branch pushes are intended to deploy automatically after tests and a Docker build pass. Review changes to workflows, deployment scripts and dependencies as production access changes. No license is supplied; repository creation alone does not grant an open-source license.
