# CarBuyerBots Stripe integration plan

Reviewed **2026-08-22** against Stripe MCP (`stripe_implementation_planner` +
live sandbox reads) on account **Car Buying Bot sandbox**
(`acct_1U73NGEJNo16bmOR`, test mode), then reconciled onto the Phase 1 Next.js
portal.

Business: buyer-funded AI car-buying agent. One-time per-car fee ($349 intro /
$399). Phase 1 charges at Checkout **before** the vehicle brief. Savings
guarantee is a full refund. **Stripe Tax is out of scope** until Mason and
counsel decide.

## What shipped in Phase 1

| Decision | Choice |
|---|---|
| Payment surface | Web, Stripe only |
| On-session pay | Stripe-hosted Checkout (`mode: payment`) in the Next.js app |
| Price selection | Server-side intro cohort: first 100 Checkout reservations at $349 |
| Fulfillment | Signature-verified webhooks only; success page never grants access |
| Saved card on file | No |
| Reconciliation | Stripe Dashboard (no ERP/warehouse yet) |
| Managed Payments / Tax | No |
| Subscriptions / Connect / car-purchase deposits | No |
| Invoices | Documented, not enabled |

Implementation lives in `app/api/checkout`, `app/api/stripe/webhook`, and
`lib/stripe/`. Checkout uses Price IDs only, never browser amounts. Test and
restricted-test keys are accepted; live keys are rejected. Webhooks persist
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.expired`, and full `charge.refunded`.

A standalone Express `server/` from the earlier payments draft is **not**
kept. That process duplicated Checkout against a file-backed store and would
fight the portal’s Supabase reservations.

## Catalog bootstrap (Mason-only)

The connected test sandbox had **no Products** and **no webhook endpoints**
when last read. MCP could not create Products. Mason claims or pastes a
restricted test key into gitignored `.env.local`, then:

```bash
npm run bootstrap:stripe
```

The script creates the $349 intro and $399 standard one-time USD Prices and
prints the IDs to paste into `.env.local`. It refuses live keys. It does not
enable Stripe Tax.

Alternatively, create the same Prices in the Dashboard as described in
`docs/setup-phase-1-portal.md`.

## Reserved off-session path (not wired)

The earlier payments draft accepted **Invoicing API + Hosted Invoice Page**
(`send_invoice`, 7 days) as the off-session bill after a business event. That
decision is preserved here so the work is not dropped:

- Create/finalize/send a Stripe Invoice with `pricing.price`, customer-visible
  line description, `engagement_id` metadata, and idempotency keys.
- Treat `invoice.paid` as settled and `invoice.payment_failed` as failed.
- Do **not** add `invoice_creation` to Checkout.
- Do **not** enable Stripe Tax or `automatic_tax`.

Phase 1 does not implement those routes. The portal is pay-first Checkout;
static checks forbid `invoice_creation` on the Checkout Session. Wire invoicing
only after Mason asks for email billing and the reservation/fulfillment schema
is extended for invoice IDs.

## Webhook events

Phase 1 (register these):

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `charge.refunded`

Local:

```bash
stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired,charge.refunded \
  --forward-to localhost:3000/api/stripe/webhook
```

Add `invoice.paid` and `invoice.payment_failed` only when invoicing is wired.

## Still Mason-only

1. **Sandbox / keys** — Restricted test key in gitignored `.env.local`. Then
   `npm run bootstrap:stripe` or Dashboard Prices.
2. **Webhook** — HTTPS URL in Workbench (`STRIPE_WEBHOOK_SECRET`).
3. **Tax counsel** — Do not enable Stripe Tax until a human decides.

This integration is **not production-ready** and must not take live charges
until Mason says so.
