# Wallet and payment checkout

## Implemented scope

The [Wallet & payments page](https://aibooking.store/wallet.html) supports administrator-issued requests for an agreed AIBooking service. Payment happens on Razorpay-hosted checkout. Available wallets and other payment methods depend on the merchant account, activation and provider eligibility; the app does not guarantee a particular wallet appears.

This integration does not create a stored-money AIBooking wallet, issue a prepaid instrument, top up a balance, transfer money, fund external providers or autonomously pay for bookings. There are no consumer accounts, cash balances, refunds API or automatic service fulfilment. The original request did not specify a wallet provider or supply merchant credentials, so hosted checkout was selected as the first integration and remains disabled by default.

## Configuration

Set these values in the protected `/home/pi/aibooking/.env` and restart/redeploy the app:

```dotenv
PAYMENTS_ENABLED=false
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Use a merchant account under the business's control. Start with Razorpay test credentials and a separate test webhook secret. Enable `PAYMENTS_ENABLED=true` only after all three credential fields are populated. Test-key mode is visibly labelled; test mode uses the provider's actual test API, not a local simulation. Live keys select live mode, and activation remains the operator's explicit environment setting.

Configure the merchant dashboard webhook URL as:

```text
https://aibooking.store/api/payments/webhook
```

Subscribe to `payment_link.paid`, `payment_link.cancelled` and `payment_link.expired`. Use the same webhook secret in the dashboard and environment. Verify test-mode creation, successful payment, webhook delivery and status refresh before switching to live credentials and live webhook configuration. No real charge or provider test transaction has been performed as part of implementation because merchant credentials are absent.

Before live collection, configure the merchant's business/support details and publish the actual service scope, pricing, fulfilment and refund terms applicable to customers. A payment request must correspond to a real agreed service. This app does not establish the business's eligibility for any regulated stored-value product; a future stored-balance wallet needs a separately scoped provider, account, ledger and regulatory review.

## Operator workflow

1. Open `/admin.html` and authenticate using `ADMIN_TOKEN`.
2. Under Wallet & payment requests, confirm that checkout is configured in the intended mode.
3. Enter the agreed amount in INR, a non-personal service/invoice description and confirm that service/refund terms are agreed. The server accepts ₹1–₹100,000 as integer paise.
4. Create the payment request. The server creates a Standard Payment Link with partial payments disabled, a 24-hour expiry, notifications disabled, reminders disabled and the wallet checkout method enabled when the merchant is eligible.
5. Open the customer page. Share it only with the intended customer through your existing authorized business process; the app sends no email, SMS or messages automatically.
6. The customer checks the description and amount and explicitly continues to Razorpay. Status is verified through signed webhooks or the Check payment status action, not through a browser success claim.
7. Fulfil the agreed service separately after verifying the payment in the merchant dashboard. Paying does not issue a ticket, fund recharge/shipping providers or automatically activate sponsorship.

Payment references are random 128-bit capabilities. Anyone with a reference can view its amount, description and payment status. Do not include names, PNRs, contact details or sensitive identifiers in descriptions. The customer link uses a URL fragment; the page reads and removes it, uses no-referrer and does not store it locally. API lookup paths still contain the reference, so redact logs and restrict access to payment metadata.

The admin view lists the latest 100 requests. Request keys prevent a retry from issuing a second provider link during the same operation. If creation fails ambiguously, the record is retained as `creation_unknown`; repeating the same key returns that record rather than issuing another link. Check Razorpay using the reference before creating a replacement. Reloading the admin page creates a new client request key, so review the existing list and provider dashboard first. Automated reconciliation of ambiguous creation is not implemented.

## HTTP endpoints

| Route | Purpose |
| --- | --- |
| `GET /api/payments/config` | Availability, provider, test/live mode; `storedBalance` is always false |
| `GET /api/admin/payment-requests` | Authenticated recent requests and configuration status |
| `POST /api/admin/payment-requests` | Authenticated creation: `{ "amount": 10000, "description": "Agreed service invoice", "requestKey": "<UUID>" }`; amount is integer paise |
| `GET /api/payments/requests/<reference>` | Capability-authorized request details; does not query the provider |
| `POST /api/payments/requests/<reference>/refresh` | Fetch provider status and validate identity, reference, currency and amount |
| `POST /api/payments/webhook` | Exact raw-body HMAC-SHA256 verification using `x-razorpay-signature` |

Admin requests require the bearer token in the Authorization header and the existing origin policy. Creation allows ten requests/minute/client; public reads allow thirty/minute/client; provider refresh allows four/minute/reference and one simultaneous refresh/reference. Limits are in memory and reset on restart.

`paid` is accepted only for matching provider ID, request reference, INR currency, exact requested amount, full amount paid and disabled partial payments. Only validated HTTPS `rzp.io` checkout destinations are exposed. Duplicate webhook state updates are harmless and paid status cannot regress. Terminal cancelled/expired states cannot return to created. Payment-link status does not track refunds, disputes, chargebacks or final settlement; inspect those separately in Razorpay. No balance is credited and no order is fulfilled by a webhook.

Common failures: `401` invalid admin credentials/webhook signature; `403` foreign browser origin; `400` invalid request or mismatched payment evidence; `404` unknown reference; `409` reused request key with different details; `413` oversized webhook; `429` limits; `502` unconfirmed provider operation; `503` disabled or incomplete configuration. Public request details remain readable while new payments are disabled; both the API and page hide checkout links when availability is disabled. Disabling new checkout does not cancel previously issued links at Razorpay: cancel those in the merchant dashboard if needed. With credentials and webhook secret still configured, signed webhooks and provider status refresh continue to verify existing requests even while PAYMENTS_ENABLED is false. Do not remove verification credentials until outstanding links are reconciled.

## Storage and recovery

`payment_requests` is an additive SQLite table in the existing app volume. It stores request/reference keys, amount, description, mode, provider link ID, checkout URL, status and timestamps. It does not store card numbers, bank credentials, UPI PINs, wallet credentials or customer contacts. There is no automatic payment-record retention/deletion policy. Include the full SQLite database in consistent backups; restoring an old backup requires reconciliation against the provider before taking further action.

Source: `payments.mjs`, payment methods in `storage.mjs`, `public/wallet.html`, `public/wallet.js`, and the admin payment section. Unit tests mock provider requests; UI tests use jsdom. Provider end-to-end testing and real-browser visual verification remain outstanding.

## Primary references

- [Razorpay Standard Payment Links](https://razorpay.com/docs/api/payments/payment-links/create-standard): server-side creation, currency/amount, expiry and notification options.
- [Payment method options](https://razorpay.com/docs/api/payments/payment-links/customise-payment-methods): wallet checkout configuration.
- [Fetch a Payment Link](https://razorpay.com/docs/api/payments/payment-links/fetch-id-standard): server reconciliation of an identified link.
- [Payment Link webhook events](https://razorpay.com/docs/webhooks/payment-links): paid/cancelled/expired events.
- [Webhook validation](https://razorpay.com/docs/webhooks/validate-test): raw-body signature verification and duplicate-event handling.
- [RBI PPI master directions](https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=12156&Mode=0&fn=9): reference for separately evaluating any future stored-value wallet.

References checked 2026-11-24. Confirm provider availability and current terms during merchant onboarding.
