# AI, operations and monetization

## Gemini assistant

The persistent Ask AI actions and dashboard command field open a conversational guide. It can navigate the real service catalog, prefill read-only rail forms, retrieve public rail information through the private MCP adapter, and explain freshly retrieved results. Users can ask in English, Hindi or other supported languages. It cannot perform transactions or claim booking confirmation. Model-selected destinations are validated against the application's catalog; arbitrary model-generated URLs are discarded.

The supplied `.env` name `GEMINI-API-KEY` was normalized to `GEMINI_API_KEY`. The key is stored in the protected server `.env` and sent to Google's API only in a server-side header. It is never embedded in public assets or prompts.

Defaults:

- `GEMINI_MODEL=gemini-3.5-flash-lite`
- `GEMINI_FALLBACK_MODEL=gemini-3.5-flash`
- `AI_DAILY_LIMIT=200` model attempts across all users, including failed and fallback attempts. This counter persists across restarts in SQLite.
- Six chat messages per minute and thirty per hour per client IP; four concurrent chat requests. IPs are used transiently for limits, not saved in the reporting database.
- Bounded context/history, output size and provider deadlines. The primary model has a 7-second deadline; the alternate has a 12-second deadline. A temporary model overload can use one alternate model. Clear train-number/station-code requests go directly to MCP before an AI explanation, avoiding an unnecessary planning call. If explanation fails after live data was retrieved, the reply is labeled as RailKit source guidance and offers the verified results instead of pretending an AI explanation succeeded. Quota exhaustion returns an explicit error rather than pretending the bot succeeded.

Messages and a bounded recent history are sent to Google Gemini. Chat is held only in browser memory and is not saved by AIBooking. Obvious long numeric identifiers and credential assignments are rejected before Gemini; this is not a universal sensitive-data detector. PNRs are excluded from model tools/context and use the dedicated form. AI explanations can make mistakes; the user can inspect live source results. Relative dates are resolved/validated server-side in IST before rail execution. Rail results are snapshots, not seat/fare guarantees.

## Compact interface

The desktop layout has a persistent grouped menu; mobile uses a compact menu and four-item bottom navigation. The dashboard displays six relevant service cards at a time. All fifteen rail tools remain available through pagination. Travel and daily categories replace long stacked home-page sections. Saved shortcuts are local service/provider IDs, not passenger data, and open in a drawer. Provider preparation/disclosure details expand when requested. Detailed rail results and forms scroll when their content requires it; the landing page is designed to avoid long scrolling rather than hiding required information.

## Monetization that can be operated now

- Provider links route through `/go/:provider`, with aggregate date/provider/source click reporting. These are outbound referrals, not unique-user or conversion/revenue measurements.
- Approved affiliate URLs and paid placements can be configured for known providers. Destination URLs must use the provider's exact HTTPS host or an additional host explicitly configured in `AFFILIATE_ALLOWED_HOSTS`.
- Affiliate and Sponsored labels appear on provider cards, shortcuts and relevant AI actions. A disclosure handoff page covers commercial links reached without the UI disclosure flag. Paid placements are separate from AI advice; paid status is not sent to the recommendation model.
- A partner/business enquiry form stores consented business contact leads for operator review. It does not email third parties or create a paid agreement.
- No affiliate ID, sponsor or paid subscription is invented. Commercial placements begin disabled. Revenue requires real affiliate/advertiser agreements and properly configured links. There is no subscription billing or payment gateway in this release.

## Operations dashboard

Open `https://aibooking.store/admin.html`. Authenticate with `ADMIN_TOKEN` from the protected local or Pi `.env`; the value is intentionally not written into these docs or chat. A strong token was generated during deployment. Do not share it or put it in URLs. The dashboard holds it only in page memory and sends it as an Authorization header.

The dashboard shows AI call/token totals, referral counts, partner enquiries and placement settings. Enquiries can be marked new/reviewed/closed. The user must already have the commercial right to activate an affiliate URL or sponsor. Default provider destinations remain active until an approved placement is configured. Unknown hosts, unsafe protocols and URL credentials are rejected.

Only the operator can read enquiries. They remain in the private SQLite database until managed by the operator; no automatic retention/deletion or email workflow is implemented. Do not collect unnecessary customer identity/payment data in enquiries.

## Persistence and updates

SQLite is stored at `/app/data/aibooking.sqlite` in the Docker volume `aibooking_app_data`, with WAL mode and non-root ownership. Preserve this volume during updates. It contains enquiry contact information, usage budgets, placements and aggregate counters. Source archives exclude it. Use a SQLite-consistent backup process before operational maintenance; a source archive alone is not a database backup.

Run `docker compose -p aibooking -f compose.pi.yaml up -d --build app` after reviewed source/config changes. Never print expanded Compose config or `.env` contents to shared logs.

## Validation and limits

Tests cover the MCP client/server flow, Gemini key handling, catalog-bound actions, date preservation, provider overload fallback, input limits, budget persistence, authentication, lead consent, safe redirects, sponsorship disclosure, service pagination, saved shortcuts and chat/form interactions through a DOM harness. Public endpoints, real Gemini calls and the Pi MCP connector are verified separately in the deployment record. The browser access host is unavailable, so rendered viewport dimensions and visual quality have not been checked with a real browser. Gemini overloads were observed; model responses are not an uptime guarantee.

Google API references:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/structured-output
