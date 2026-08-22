# CarBuyerBots

Phase 1 is a Next.js customer portal for a one-time car-buying service fee. It
uses Stripe-hosted Checkout in test mode, Supabase passwordless email
authentication, owner-scoped Postgres RLS, conversational vehicle intake, a
customer status record, and an admin review queue.

This repository is intentionally test-only. It supports no live keys or live
charges, Stripe Tax, invoices, subscriptions, saved cards, or Connect.

## Local setup

Requirements: a current Node.js/npm installation and, only for the optional
local database stack, Docker plus the Supabase CLI.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set these exact variables in `.env.local`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Hosted or local Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service-role key |
| `NEXT_PUBLIC_APP_URL` | App origin, for example `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Stripe test or restricted-test secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the test webhook endpoint or CLI listener |
| `STRIPE_PRICE_INTRO_ID` | Test one-time USD Price ID for the introductory $349 fee |
| `STRIPE_PRICE_STANDARD_ID` | Test one-time USD Price ID for the standard $399 fee |
| `APP_DEMO_MODE` | `true` only to expose local non-production review fixtures; otherwise `false` |

Never prefix a secret with `NEXT_PUBLIC_`, commit `.env.local`, or put a real
credential in documentation. `APP_DEMO_MODE=true` is for local review only and
still returns 404 when `NODE_ENV=production`.

## Review fixtures

With no external project connected:

```bash
APP_DEMO_MODE=true npm run dev
```

Open:

- `/preview/onboarding`
- `/preview/portal`
- `/preview/admin`
- `/preview/admin/engagements/a6204b70-c308-40e8-b87f-30843d48cb79`

The routes use fictional records. Intake changes are in memory; portal/admin
writes are disabled. They import no service-role or Stripe write path, are
marked `noindex`, are omitted from the sitemap, and 404 unless the explicit
non-production guard passes.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm ls --all
git diff --check
```

See [`docs/setup-phase-1-portal.md`](docs/setup-phase-1-portal.md) for local
Supabase migrations, hosted email-confirmation and magic-link redirects, dual
admin assignment, Stripe test Products/Prices, webhook forwarding and
registration, supported events, and the deployment checklist.
