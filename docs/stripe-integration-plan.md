# CarBuyerBots Stripe integration plan

Reviewed **2026-08-22** against Stripe MCP (`stripe_implementation_planner` + live sandbox reads) on account **Car Buying Bot sandbox** (`acct_1U73NGEJNo16bmOR`, test mode).

Business: buyer-funded AI car-buying agent. One-time per-car fee ($349 intro / $399). Charge after the brief is confirmed. Savings guarantee is a full refund. **Stripe Tax is out of scope** until Mason and counsel decide.

## Planner decisions (accepted)

| Decision | Choice |
|---|---|
| Payment surface | Web, Stripe only |
| On-session pay | Stripe-hosted Checkout (`mode: payment`) |
| Off-session pay | Invoicing API on a business event (brief confirmed), Hosted Invoice Page |
| Invoice creation | Automatic via API, not Dashboard-only |
| Saved card on file | No — customer pays the hosted invoice |
| Reconciliation | Stripe Dashboard (no ERP/warehouse yet) |
| Managed Payments / Tax | No |
| Subscriptions / Connect / car-purchase deposits | No |

## Implementation (closed in this repo)

- Hosted Checkout Sessions with **Price IDs only**, `invoice_creation.enabled`, no `payment_method_types`, `integration_identifier`.
- Two Products/Prices once bootstrapped: intro $349 and standard $399. Intro cohort is counted from **paid** webhook records.
- `send_invoice` Invoices with `pricing.price`, customer-visible line description, `engagement_id` metadata, idempotency keys.
- Webhooks verify signatures on the raw body, skip duplicate `event.id`, fulfill Checkout only when `payment_status` is not `unpaid`, treat `invoice.paid` as settled, and mark `charge.refunded` / `refund.created`.
- Admin refunds for the guarantee (`x-admin-key`, timing-safe compare). Dashboard refunds also land via webhook.
- Secrets stay in `.env` (gitignored). Restricted keys preferred.

## Sandbox gap (not a code bug)

MCP read of Mason’s connected **test** sandbox on 2026-08-22:

- Products: **none**
- Webhook endpoints: **none**
- MCP session can **read** the account but **cannot create Products** (missing write permission on the connected key)

The earlier agent-provisioned sandbox is not this account and must not be treated as production. Do not invent keys. Keep test/sandbox mode until Mason claims or pastes his own restricted test key and runs bootstrap.

## Webhook events to register (when Mason has a public URL)

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`
- `refund.created`

Local: `stripe listen --forward-to localhost:4242/api/webhooks/stripe`

## Still Mason-only

1. **Sandbox / keys** — Claim or open the Car Buying Bot sandbox in the Dashboard, create a restricted test key, put it in gitignored `.env`. Then `cd server && npm run bootstrap` and paste the Price IDs.
2. **Production (or even durable test) webhook** — After the server has an HTTPS URL, add the events above in Workbench and set `STRIPE_WEBHOOK_SECRET`.
3. **Tax counsel** — Do not enable Stripe Tax or `automatic_tax` in this integration until a human decides.

This integration is **not production-ready** and must not take live charges until Mason says so.
