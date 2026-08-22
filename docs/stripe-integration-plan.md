# CarBuyerBots Stripe integration plan

Tailored for **CarBuyerBots** (`carbuyerbots.com` / carbuyingbot.com): a buyer-funded AI car-buying agent with a **one-time per-car fee** ($349 intro for the first 100 customers, then $399), a **save-more-than-the-fee-or-it’s-free** guarantee, and no subscriptions.

This plan was generated from Stripe’s current best-practices skills because `stripe_implementation_planner` is not usable until the Stripe MCP server at `https://mcp.stripe.com` is authenticated in Cursor.

## Products in scope

| Need | Stripe product | How we use it |
|---|---|---|
| Collect the engagement fee when the buyer is on the site | **Payments** via [Checkout Sessions](https://docs.stripe.com/payments/checkout.md) (`mode: payment`) | Hosted Checkout. Dynamic payment methods (do **not** pass `payment_method_types`). |
| Bill after the buyer confirms their brief, or send a professional invoice | **Invoicing** | `collection_method: send_invoice` plus hosted invoice page. Checkout also sets `invoice_creation.enabled` so card payments still produce a Stripe Invoice. |

Not in v1: Billing subscriptions, Connect, Payment Element, Charges/Tokens/Sources.

## Money model

- Two **Products** (intro vs standard). Stripe shows the Product name on invoices; different tiers must not share one Product.
- One **Price** each: `34900` and `39900` USD. Checkout and Invoices always reference Price IDs — never a client-supplied amount.
- Intro cohort: first **100 paid** engagements use the intro Price; later ones use standard. Count paid records from webhooks, not from button clicks.
- Guarantee: full **Refund** on the PaymentIntent (`reason: requested_by_customer`, metadata `guarantee=save_more_than_fee_or_free`). Do not auto-refund from the public site.

## Customer journey

1. Landing page captures email (existing Web3Forms lead). Copy stays: fee is due **after the brief is confirmed**.
2. When the brief is confirmed, either:
   - **On-session:** buyer opens `/pay` and we create a Checkout Session; or
   - **Off-session:** an operator calls `POST /api/invoices` and Stripe emails a hosted invoice (due in 7 days).
3. Webhooks mark the engagement **paid**. That is the source of truth — not the success page.
4. If savings < fee, an operator issues a refund via `POST /api/admin/refunds`.

## Required webhooks

Verify signatures with the raw body. Persist `event.id` and skip duplicates.

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded` (fulfill only when `payment_status` is not `unpaid`)
- `checkout.session.async_payment_failed`
- `invoice.paid`
- `invoice.payment_failed`

## Security

- Restricted key (`rk_` / sandbox `rkcs_`) in the environment or a secrets vault — never in git or the browser.
- Publishable key is only needed if we later embed Checkout; hosted Checkout does not require Stripe.js on the marketing site.
- Admin invoice/refund routes require `x-admin-key`.
- Do not enable `automatic_tax` until there is an **active** Stripe Tax registration. Service tax treatment for US car-buying assistance should be confirmed with counsel.

## Go-live checklist

1. Claim the sandbox (or use a live Stripe account) and replace env keys.
2. Create live Products/Prices (`npm run bootstrap` in `server/` with live keys).
3. Register the webhook endpoint in Workbench; copy `STRIPE_WEBHOOK_SECRET`.
4. Turn on the payment methods you want in the Dashboard (dynamic methods).
5. Work through Stripe’s [Go Live Checklist](https://docs.stripe.com/get-started/checklist/go-live.md).
