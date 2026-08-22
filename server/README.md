# Stripe server (Payments + Invoicing)

Node process next to the static CarBuyerBots landing page. Test/sandbox only until Mason explicitly goes live.

## Local setup

1. Copy `.env.example` to `.env`. Use a **restricted test key** from the Car Buying Bot sandbox. Never commit `.env`.
2. `cd server && npm install`
3. `npm run bootstrap` — creates the $349 intro and $399 standard Products/Prices. Paste IDs into `.env`.
4. `stripe listen --forward-to localhost:4242/api/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET`.
5. `npm start` — site at `http://localhost:4242`, Checkout at `/pay/`.

Do not enable Stripe Tax. Do not send live charges.

## API

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/api/checkout` | Buyer | Hosted Checkout Session (Price ID from intro cohort). |
| POST | `/api/invoices` | Operator (`x-admin-key`) | Email a Stripe Invoice (`send_invoice`, 7 days). |
| POST | `/api/webhooks/stripe` | Stripe | Signature-verified fulfillment. |
| POST | `/api/admin/refunds` | Operator (`x-admin-key`) | Full refund for the savings guarantee. |

Never send amounts from the browser. Catalog lives in Stripe Prices.

See `docs/stripe-integration-plan.md` for the MCP review and Mason-only remaining items.
