# Stripe server (Payments + Invoicing)

Node process that sits next to the static CarBuyerBots landing page.

## Local setup

1. Copy `.env.example` to `.env` at the repo root and fill in Stripe keys.
2. `cd server && npm install`
3. `npm run bootstrap` — creates the $349 intro and $399 standard Products/Prices. Paste the printed IDs into `.env`.
4. Forward webhooks: `stripe listen --forward-to localhost:4242/api/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET`.
5. `npm start` — landing page at `http://localhost:4242`, Checkout at `/pay/`.

## API

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/api/checkout` | Buyer | Hosted Checkout Session (Price ID from intro cohort). |
| POST | `/api/invoices` | Operator (`x-admin-key`) | Email a Stripe Invoice (`send_invoice`, 7 days). |
| POST | `/api/webhooks/stripe` | Stripe | Signature-verified fulfillment. |
| POST | `/api/admin/refunds` | Operator (`x-admin-key`) | Full refund for the savings guarantee. |

Request bodies are JSON: `{ "email", "name?" }` for checkout/invoices; `{ "engagementId" }` for refunds.

Never send amounts from the browser. Catalog lives in Stripe Prices.
