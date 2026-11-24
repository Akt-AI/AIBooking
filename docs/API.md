# HTTP API

Base URL: `https://aibooking.store`. Development: `http://localhost:3000`. API responses are not an inventory or booking guarantee. Routes return JSON unless noted. JSON POST requests require `Content-Type: application/json`.

## Health and configuration

`GET /api/status` reports process health and configuration flags:

```json
{"status":"ok","mode":"rail-information","railBooking":false,"ap2Payments":false,"railkitConfigured":true,"aiConfigured":true,"railMcpEnabled":true}
```

Credential flags indicate presence, not validation, provider reachability or account entitlement. The MCP flag identifies the local adapter, not an independent provider connection.

## Rail information

`GET /api/railkit?type=<operation>&...`

| Operation | Inputs |
| --- | --- |
| `search` | `from`, `to`, optional `date` |
| `train` | `value` = train number |
| `availability`, `fare` | `value` = train number, `from`, `to`, `date`, optional `travelClass` and `quota` |
| `pnr` | `value` = ten-digit PNR |
| `tracking`, `tracking-v2` | `value` = train number, `date` = train start date |
| `station` | `value` = station code, optional `hours` = `2`, `4` or `8` |
| `timetable` | `value` = station code, optional `date` |
| `history` | `value` = train number, `date` = completed journey start date |
| `cancellations` | None |
| `station-code` | `value` = station code |
| `stations-name` | `value` = station name, 2–80 characters |
| `train-number` | `value` = train number |
| `trains-name` | `value` = train name, 2–80 characters |

Train numbers have five digits. Station codes accept 1–5 letters/digits and are normalized to uppercase. Origin and destination must differ. Dates are `YYYY-MM-DD`, validated in Asia/Kolkata:

| Use | Allowed dates |
| --- | --- |
| Search, availability and fare | Today onward; date optional only for search |
| Both tracking operations | Today and the previous five calendar days |
| Station timetable | Yesterday, today or tomorrow; may omit date |
| Journey history | Today or an earlier date; provider must have a completed record |

`travelClass` defaults to `3A`, `quota` to `GN`, and station `hours` to `2`. Availability allows classes `1A, 2A, 3A, 3E, SL, 2S, CC, EC` and quotas `GN, LD, SS, TQ`. Fare allows additional classes and quotas: use the exact choices in [`public/services.js`](../public/services.js), which is the authoritative schema.

```sh
curl --fail 'http://localhost:3000/api/railkit?type=search&from=NDLS&to=HWH'
curl --fail 'http://localhost:3000/api/railkit?type=train&value=12301'
```

Successful envelope:

```json
{"source":"RailKit","service":"train","retrievedAt":"2026-11-24T12:00:00.000Z","data":{}}
```

`data` is provider-defined and varies by operation; `{}` above is an envelope illustration, not a real train response. Do not assume fixed nested fields or infer weekday order from an undocumented running-day bit string.

| Status | Meaning |
| --- | --- |
| `400` | Unsupported service or invalid input |
| `404` | Provider-reported missing data, based on recognized error text |
| `405` | Rail endpoint requires GET |
| `429` | App limit or recognized provider rate/quota error |
| `502` | Provider failure, timeout, exception or unclassified unsuccessful result |
| `503` | Missing credential or unavailable installed SDK operation |

Failures have an `error` string and usually `source: "RailKit"`; source/configuration fields vary by failure. The classification is based partly on provider error text and does not reliably distinguish every account-permission failure. No automatic retries, cached results or independent-provider failover are implemented. Never send a real PNR in documentation, issue reports, shell history or chat.

## AI guide

`POST /api/assistant`

```json
{"message":"Find trains from NDLS to HWH tomorrow","history":[]}
```

Messages must contain 2–1,200 characters. Optional history contains at most six `{ "role": "user" | "assistant", "text": "..." }` entries, each at most 1,600 characters. The JSON body limit is 12,000 bytes. The UI may apply tighter limits. Optional result-explanation context is an internal UI contract; the server validates and re-fetches rail data.

Success includes a reply and safe catalog actions; source/provenance fields depend on whether a live query occurred and whether Gemini completed. Clients should tolerate optional fields and display verified source labels. Limits are six requests/minute and thirty/hour per client address, four concurrent requests, and a persistent daily model-attempt budget. Each model attempt, rather than each chat message, counts against that budget. Invalid/sensitive input returns `400`, disallowed origin `403`, oversized body `413`, wrong content type `415`, limits `429`, provider errors `502`, or missing AI configuration `503`.

## Provider handoffs and enquiries

| Route | Behavior |
| --- | --- |
| `GET /api/commerce` | Public provider placement flags; no private admin data |
| `GET /go/<provider-id>` | Validated provider redirect, or commercial disclosure page before continuing |
| `HEAD /go/<provider-id>` | Resolves handoff without recording a click; commercial disclosure can return HTML status |
| `POST /api/partner-enquiries` | Saves a consented business enquiry; sends no email or payment |

Provider IDs are defined in [`public/bookings.js`](../public/bookings.js). Arbitrary destination URLs are not accepted. Optional referral `source` is `directory`, `assistant`, `sponsored` or `saved`. Commercial disclosure state is carried by `disclosed=1`; public clients should obtain flags and show the disclosure before using it.

Enquiry request:

```json
{"company":"Example business","email":"contact@example.com","interest":"sponsorship","message":"Please share placement options.","consent":true,"website":""}
```

`interest` is `sponsorship`, `affiliate` or `business-concierge`. Company is 2–100 characters; message is 10–2,000 characters; a valid email and literal consent `true` are required. Leave the honeypot `website` empty. Limits: 5,000-byte body, three submissions/hour/address, maximum 5,000 stored enquiries. Success is `201` with an ID and message. Use a development database for test submissions.

## Admin APIs

Send `Authorization: Bearer <ADMIN_TOKEN>` in a header. Never put the token in a URL. Missing, incorrect or shorter-than-24-character configured credentials return `401`. These routes also enforce the allowed Origin list when an Origin header is supplied; requests without Origin still require authentication.

| Route | Request/response |
| --- | --- |
| `GET /api/admin/report` | Recent AI totals, aggregate referral clicks, enquiries, placements and catalog providers |
| `POST /api/admin/placements` | `{ "provider": "<known-id>", "url": "https://<approved-host>/...", "affiliate": false, "sponsored": false }` |
| `POST /api/admin/leads` | `{ "id": "<enquiry-id>", "status": "reviewed" }`; status is `new`, `reviewed` or `closed` |

The report is bounded to 30 AI days, 500 click rows and 300 enquiries. Placement bodies are limited to 4,000 bytes; lead updates to 1,000 bytes. There is no enquiry-delete endpoint or public account API. Unsupported `/api/*` paths return `503` with the application's booking/payments-unavailable message; do not interpret them as transaction endpoints.
