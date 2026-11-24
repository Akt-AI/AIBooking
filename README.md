# AIBooking

Compact AI-assisted rail, travel and daily-services PWA at https://aibooking.store/, deployed through Docker Compose on SSH host `pi`. Powered by server-side `railkit@6.0.0`.

## Documentation

Start with the [documentation index](docs/README.md), [local setup](docs/DEVELOPMENT.md), [architecture](docs/ARCHITECTURE.md), [API reference](docs/API.md), [operations and troubleshooting](docs/OPERATIONS.md), or [GitHub CI/CD](deploy/GITHUB-ACTIONS.md). A credential-free configuration template is provided in [.env.example](.env.example).

Source and documentation are published to [Akt-AI/AIBooking](https://github.com/Akt-AI/AIBooking). GitHub Actions tests main-branch pushes and deploys passing revisions to pi. Check the [Actions history](https://github.com/Akt-AI/AIBooking/actions) for each deployment outcome.

## AI and a compact dashboard

The Gemini assistant helps users discover services, prefill read-only forms, retrieve and explain live rail information, and prepare a travel/shipping checklist. The dashboard shows six contextual actions at a time with desktop/sidebar and mobile/bottom navigation. Saved service shortcuts open in a drawer; long details expand on request. All fifteen rail services remain available via pagination.

Commercial features include tracked provider referrals, configurable and disclosed affiliate/sponsored links, business enquiry capture and an authenticated operations dashboard. Paid placements are disabled until real agreements and links are configured. There is no subscription billing. An optional [hosted wallet/payment checkout](docs/PAYMENTS.md) supports agreed AIBooking service requests; it is disabled until merchant credentials and webhooks are configured. See [AI and monetization operations](deploy/AI-MONETIZATION.md).

The bot uses a private [RailKit MCP adapter](deploy/MCP.md) with fourteen read-only tools and an optional SSH/stdio connection for external MCP clients. This is our adapter, not an upstream RailKit MCP service or an additional rail-data provider.

## Available services

- Direct train search between any supported station codes, with optional date.
- Train routes, schedules, running days and train-number lookup.
- Seat availability and fare breakdown by journey, class and quota.
- PNR status.
- Live running status through the primary and alternative RailKit trackers.
- Live station arrivals/departures for 2, 4 or 8 hours.
- Station timetables and station details/code lookup.
- Station-name and train-name searches.
- Completed journey history.
- Fully/partially cancelled train information.

These are 15 service operations exposed by the installed SDK. All result data comes from RailKit; provider coverage, data freshness, account entitlement and service availability can vary. Errors are displayed without fabricated results. The SDK does not expose the newer map/delay/amenities functions mentioned in some current upstream documentation, so those are not presented.

There is no simulation mode, fictional inventory, local demo ticket flow or payment form. The AI guide provides information and navigation; it cannot transact. AIBooking does not issue or cancel tickets; users can open the official IRCTC portal for booking. Existing browser-stored demo records are no longer accessed and remain untouched.

## Wallet & payments

The menu links to a compact [payment page](https://aibooking.store/wallet.html). Administrators can issue fixed-amount INR service requests through Razorpay; payment status is verified on the server. Existing wallets and other payment methods are presented by provider checkout when eligible. This does not hold user funds, top up an AIBooking balance or pay for external provider bookings. See [activation, API and operational limits](docs/PAYMENTS.md).

## Booking options

The service directory offers 11 categories and 23 provider options, grouped into Travel, Shows & events, Recharge & bills, and Ship a parcel:

| Category | Providers | Integration |
| --- | --- | --- |
| Flights | Skyscanner, Air India, IndiGo | Optional Skyscanner flight-search widget; public booking links |
| Hotels/stays | Booking.com, Agoda | Public provider booking links |
| Buses | redBus, AbhiBus | Public provider booking links |
| Cabs/transfers | Uber | Public mobile-web booking link |
| Activities | GetYourGuide | Public provider booking link |
| Movies/shows | BookMyShow, District | Public ticket-provider links; choose city/show there |
| Concerts/events | BookMyShow, District | Public event-provider links; choose city/event there |
| Mobile recharge | Paytm, PhonePe, Jio, Airtel | Public recharge links; PhonePe requires its app |
| Bills/utilities | Paytm, PhonePe | Public service links; PhonePe requires its app |
| Domestic shipping | Delhivery, DTDC | Personal shipment booking/quote links |
| International shipping | DHL Express, DTDC | International shipment booking/quote links |

The widget loads only after the user clicks Load flight search. Its official loader runs in a separate iframe page with a dedicated CSP; the main app does not allow external scripts. Direct provider links remain available when the widget is blocked or unavailable. No transactional booking API, fabricated inventory, fare estimates or booking confirmations are used. Approved affiliate URLs can be configured and are disclosed when active. No journey details are collected by the link directory or claimed to be prefilled on provider sites. Checkout, payment, confirmation, cancellation and customer support stay with the selected provider. Mobile numbers, subscriber/bill identifiers, UPI PINs, shipment addresses and identity/customs documents are entered with the provider, not collected by this directory. International shipping preparation is shown without claiming eligibility, customs clearance or a guaranteed rate/transit time. Provider handoffs do not imply a commercial partnership; commercial settings start disabled.

Skyscanner documents widget use without affiliate signup, but commission tracking requires approval and an affiliate identifier. Other monetization or deeper APIs would require the respective provider's onboarding. No third-party account was created or agreement accepted during this implementation.

Primary references checked 2026-11-24:
- https://www.partners.skyscanner.net/product/affiliates
- https://www.partners.skyscanner.net/affiliates/widgets-documentation/flight-search-widget
- https://www.booking.com/affiliate-program/v2/index.html
- https://www.redbus.in/
- https://www.abhibus.com/
- https://m.uber.com/
- https://www.getyourguide.com/
- https://in.bookmyshow.com/
- https://www.district.in/
- https://paytm.com/recharge
- https://paytm.com/recharge-bill-payment
- https://www.phonepe.com/payments/
- https://www.jio.com/selfcare/recharge/mobility/
- https://www.airtel.in/recharge-online
- https://www.delhivery.com/solutions/personal-courier
- https://www.dtdc.com/shipment/
- https://mydhl.express.dhl/in/en/home.html

## Run

Use Node.js 24, matching the Docker image and CI workflow.

```sh
npm ci --ignore-scripts
cp .env.example .env
chmod 600 .env
# Edit .env with your credentials.
npm test
node --env-file=.env server.mjs
```

Open http://localhost:3000. For live queries, provide `RAILKIT_API_KEY` as a server environment variable; Compose reads it from protected server `.env`. Running Node directly requires exporting it explicitly. Never put the key in browser code.

## API

`GET /api/railkit?type=...` uses the service definitions in `public/services.js`. Inputs are validated on the server before calling the SDK. Dates use ISO `YYYY-MM-DD` at the app boundary, are validated relative to IST, then converted to the SDK's `DD-MM-YYYY` format. Station codes accept 1–5 alphanumeric characters; train numbers require 5 digits; PNRs require 10 digits. Class/quota choices are validated per operation.

Examples:

```text
/api/railkit?type=search&from=NDLS&to=HWH
/api/railkit?type=train&value=12301
/api/railkit?type=station&value=NDLS&hours=4
/api/railkit?type=stations-name&value=Delhi
/api/railkit?type=cancellations
```

Responses include the service, RailKit source and retrieval time. All API responses are no-store. PNR queries/results are not saved by the app or service worker. The PWA caches only the app shell and booking directory; railway queries and external booking providers require a network connection. Train-search results link to route, availability and fare forms with their journey inputs prefilled. Long result sets have Show more controls.

RailKit requests have a 20-second app deadline. Missing keys, unavailable services, provider limits and failures produce explicit errors with no fallback data. The public server applies a shared in-memory 20-queries/minute limit through the existing proxy; add authenticated quotas and trusted proxy handling before increasing public usage.

## Deployment

Pi uses Compose project `aibooking` and `compose.pi.yaml`, with the existing Caddy proxy serving loopback port 3090. Hostinger DNS and a Let's Encrypt apex/wildcard certificate are maintained separately; daily renewal is enabled.

The protected environment and certificate-maintenance source remain at `/home/pi/aibooking`. Successful release source is selected by `/home/pi/aibooking-current`; its commit is recorded in `/home/pi/aibooking-current-revision`. The tested deployment script builds an extracted committed release, preserves the application volume and attempts image rollback on startup failure. See [operations](docs/OPERATIONS.md), [CI/CD setup](deploy/GITHUB-ACTIONS.md), and [the deployment record](deploy/PI-DEPLOYMENT.md).

```sh
ssh pi 'cat /home/pi/aibooking-current-revision'
curl --fail https://aibooking.store/api/status
```

Do not run the default standalone Compose configuration on the existing Pi because its proxy already owns ports 80/443. Preserve the server `.env`, data and certificate volumes. Configuration flags in `/api/status` do not verify upstream credentials or service availability.

## Validation

Automated tests cover all 15 SDK dispatch mappings, argument order, class/quota restrictions, IST date windows, provider error/limit handling, timeouts, SDK import retry, static assets and removal of simulation functionality. Live provider smoke checks and deployment outcomes are recorded in the deployment guide. Browser verification is limited by browser-host availability.

Upstream API reference: https://github.com/RAJIV81205/RailKit
