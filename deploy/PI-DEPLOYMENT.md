# AIBooking deployment record

Verified 2026-11-24. Public URL: https://aibooking.store/ (www and wildcard hosts also covered).

- SSH alias: `pi`; public IPv4: `187.127.186.243`; hostname `mail`; x86_64 server.
- Application directory: `/home/pi/aibooking`; project `aibooking`; Compose file `compose.pi.yaml`.
- Application container: `aibooking-app-1`, health check passing; bound only to `127.0.0.1:3090`.
- Existing shared proxy: `caddy-mail`, host networking. Configuration: `/home/pi/workspace/neo-platform/infra/caddy/Caddyfile`. Existing configuration backed up beside that file with a timestamp before editing. Existing mail, webmail and social site blocks retained.
- Caddy local admin endpoint enabled at `127.0.0.1:2019` for graceful reloads. Initial change required one proxy restart.
- Hostinger apex `@` and wildcard `*` A groups point to `187.127.186.243`, TTL 300. Existing www CNAME retained. Authoritative DNS and public resolvers confirmed.
- Let's Encrypt certificate covers `aibooking.store` and `*.aibooking.store`; issuer YE1; expires February 22, 2027 at 10:21:04 UTC. Certificate files stored under `live/aibooking.store` in existing external volume `infra_certbot_data`, mounted read-only by Caddy.
- ACME account state and key persist in `aibooking_acme_state`. acme.sh writes the renewed certificate into the shared certificate volume. ACME image digest is pinned in compose.pi.yaml; automatic script upgrades disabled.
- Hostinger credential read from local `.env` and transferred over SSH stdin into mode-600 `/home/pi/aibooking/.env`. No credential added to app image or public JS. Treat the ACME state volume and server `.env` as secrets.
- User-systemd `aibooking-renew.timer` enabled/active with daily randomized schedule and persistent missed-run handling. `pi` has linger enabled. Its service ran successfully with exit status 0, skipped issuance because the certificate is current, and validated/reloaded Caddy successfully.
- `deploy/renew-pi.sh` persists the last loaded certificate hash; failed reloads retry on the next run. A temporary private log lets `cleanup-acme.py` remove only validation TXT values named by that run. This compensates for the observed upstream Hostinger hook cleanup parsing failure and preserves unrelated TXT values.

## Update the application

Copy reviewed source to `/home/pi/aibooking`, excluding `.env`, `.git`, `node_modules`, `.tls-loaded.sha256` and local secrets. Then:

```sh
ssh pi 'cd /home/pi/aibooking && docker compose -p aibooking -f compose.pi.yaml up -d --build app'
curl --fail https://aibooking.store/api/status
```

Do not run default `docker compose up` here; the standalone configuration would conflict with the existing proxy. Preserve server `.env` and all certificate volumes.

## Certificate operations

```sh
ssh pi 'systemctl --user start aibooking-renew.service'
ssh pi 'systemctl --user show aibooking-renew.service -p Result -p ExecMainStatus'
ssh pi 'systemctl --user list-timers aibooking-renew.timer'
```

Do not force production issuance for routine checks. The test run checked the renewal path and reload, not a second forced issuance. Update the pinned ACME image deliberately after testing.

User unit files are in `/home/pi/.config/systemd/user/`. Deployment uses the scripts in this project; standalone root-systemd templates are not installed on this server.

## Verification and limits

- Public HTTP redirects to HTTPS; apex and www HTTPS return 200.
- Public status reports rail-information mode, RailKit configured, and ticket booking/AP2 payments disabled.
- Certificate chain, SANs and validity verified through public TLS. App assets load with expected content types.
- 17 automated tests pass; SDK installs with no reported npm vulnerabilities.
- Browser host unavailable; rendered UI and phone interactions were not verified during deployment.
- Existing unrelated server issues observed: social API/signaling containers restarting and the pre-existing epsilonpi.tech certificate expired. These were not modified by this deployment.

## RailKit activation

On 2026-11-24, transferred RAILKIT_API_KEY from local .env to the protected server .env without printing it and recreated only the app service. Public status reports railkitConfigured=true. A real public request to `/api/railkit?type=train&value=12301` returned HTTP 200, source RailKit, simulated=false, and trainInfo/route data. Bookings and payments remain simulated.

## Rail information release — 2026-11-24

Removed the simulation module, fictional train inventory, booking/payment UI and assistant. The live app exposes all 15 information operations exported by railkit@6.0.0. Service forms validate station/train identifiers, class/quota choices and IST date windows; train search results link to route, fare and availability forms. Service-worker cache version is v3 and includes services.js instead of simulation.js. Old browser-local demo records are left untouched but never read.

Before deployment, live SDK checks returned real results for 13 operations: train details, direct train search, availability, fare, both trackers, station board, timetable, cancellations, station-name/code lookup and train-name/number lookup. A history query returned no-record-found and was correctly surfaced as HTTP 404. No real passenger PNR was queried; PNR dispatch is covered by mocked tests.

After rebuilding only the app service, public train search and station-name lookup returned HTTP 200 with RailKit results, status reported mode=rail-information, and simulation.js returned HTTP 404. Public page and service-worker contents confirmed removal of simulation and cache update. All 17 automated tests passed. Browser visual/interaction verification remains unavailable because the browser access host could not be reached.

A source rollback archive is retained at `/home/pi/aibooking-before-rail-services-20261124.tgz`. It excludes credentials and dependencies. Restoring it would restore the prior application; preserve the server .env and TLS volumes if rollback is needed.

## Booking hub release — 2026-11-24

Deployed five categories with nine public booking providers: Skyscanner/Air India/IndiGo flights, Booking.com/Agoda stays, redBus/AbhiBus buses, Uber cabs and GetYourGuide activities. These are outbound links with provider-owned checkout, not transactional booking APIs. There are no affiliate IDs or commission claims. No account was created and no third-party agreement accepted.

An optional official Skyscanner FlightSearchWidget is hosted inside `/flights.html`. The outer app creates that iframe only after explicit user interaction. Only the iframe page permits the official widget/CDN script origins and inline widget styles. The primary app retains its self-only script policy. The provider handles search inputs and onward booking; its public direct link is always visible if embedding fails.

The v4 service worker caches bookings.js with the app shell, never third-party widget content or checkout pages. All 20 tests passed, including provider-host allowlisting, arbitrary destination rejection, lazy embedding and CSP boundaries. Public page, booking module, widget assets, status and service worker returned HTTP 200. Browser access remains unavailable, so actual widget rendering, provider redirects and phone interaction have not been visually verified.

Pre-release rollback archive: `/home/pi/aibooking-before-booking-hub-20261124.tgz`, excluding secrets and dependencies. Updated only the app service; existing TLS/proxy and RailKit configuration were retained.

## Daily-services release — 2026-11-24

Added six categories: movies/shows, concerts/live events, mobile recharge, bills/utilities, domestic shipments and international shipments. The directory now has 11 categories and 23 provider options, organized into four groups to avoid a long mobile category strip. Daily services also have a separate home-page grid and direct `#book-...` fragments.

Providers added: BookMyShow and District for entertainment; Paytm, PhonePe, Jio and Airtel for recharge; Paytm and PhonePe for utility services; Delhivery and DTDC for domestic personal shipments; DHL Express and DTDC for international shipments. PhonePe links identify its app requirement and open its official information page. These are public external-service handoffs; no API contracts, accounts or credentials were added. No mobile numbers, bill IDs, addresses, KYC documents or payment details are collected by the directory, and no transaction-status integration is claimed.

Shipping categories include preparation guidance for dimensions/weight, pickup/delivery coverage and carrier-managed customs/KYC requirements. There are no fabricated prices, serviceability results, customs outcomes, labels or tracking numbers. The service-worker cache is v5. All 22 tests passed. Browser visual verification remains unavailable.

Rollback archive before this release: `/home/pi/aibooking-before-daily-services-20261124.tgz` (secrets excluded). Only the application service was rebuilt.

## AI, monetization and compact UI/MCP release — 2026-11-24

The current release replaces the long landing page with a compact dashboard: desktop sidebar, four-item mobile bottom navigation, six contextual service cards, rail-service pagination, grouped provider pages and a saved-shortcuts drawer. Preparation and provider disclosures are expandable. Detailed forms/results may scroll when needed. The service worker is v8.

Gemini key configuration was normalized from GEMINI-API-KEY to GEMINI_API_KEY in the protected .env, then transferred securely to the Pi. The primary model is gemini-3.5-flash-lite with gemini-3.5-flash fallback. Provider overloads were observed; deadlines, a persistent 200-attempt daily budget and per-client/concurrency limits bound usage. Live data remains inspectable if an explanation fails. English/Hindi replies and public date-correct rail queries were verified.

The bot retrieves rail data via a private MCP client/server adapter using @modelcontextprotocol/sdk@1.32.2 and existing railkit@6.0.0. Fourteen read-only tools exclude PNR and all transactional/admin actions. There is no public unauthenticated MCP route. The optional external connector uses SSH/stdio. A real Pi MCP initialize/listTools call found 14 tools; rail_train(12301) returned source RailKit, via MCP, status 200 and nine route stops. See MCP.md and mcp-client.example.json.

Monetization includes aggregate tracked outbound referrals, operator-configurable affiliate URLs, disclosed sponsored provider cards, a consented business-enquiry form and the protected /admin.html dashboard. No real affiliate/sponsor deal, subscription or payment setup was invented. All placements start disabled. ADMIN_TOKEN was generated and stored only in protected .env. Public unauthenticated report access returned 401, authenticated report access returned 200, and existing AI-budget data survived container recreation.

SQLite state is stored in the new persistent volume aibooking_app_data under /app/data. Source backups exclude that volume. Preserve it during updates. Current production enquiry and placement counts are zero; valid lead capture/disclosure mutations are covered by in-memory/persistence tests rather than publishing fictitious commercial data.

All 41 automated tests pass, including DOM-based navigation/pagination/chat/enquiry tests, API protection, durable budgets, referral disclosures and both MCP transports. Public assets, admin HTML, status, referrals and real AI/MCP data were checked. The browser access host remains unavailable, so no real-browser visual or viewport-overflow claim is made.

Rollback artifacts: aibooking-app:before-ai-20261124, aibooking-app:before-compact-20261124 and corresponding source archives in /home/pi. These do not back up SQLite. Only the app service was recreated; the existing shared proxy, TLS renewal and DNS remain in place.

Final production checks: the compact v8 assets returned 200; an AI rail request returned date-correct MCP source data for 2026-11-25 and retained a usable source-results action when model explanation was unavailable. A separate container-side real Gemini request returned a generated route explanation after a temporary primary-model 503, confirming the configured model fallback works. Gemini latency/availability remain provider-dependent; no uninterrupted-AI claim is made. Unauthenticated operations reports returned 401; authenticated reports returned 200, persisted prior usage, and showed zero enquiries/paid placements. Invalid enquiries were rejected without inserting a fictitious lead. Provider redirects were validated. Final container health is healthy and no temporary MCP test container remains running.
