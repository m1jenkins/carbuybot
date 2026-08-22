# Phase 1 Portal Setup and Security

This runbook covers external configuration for the Phase 1 portal. The
repository has no connected Supabase project and this task does not apply a
remote migration or create a Stripe Checkout Session.

Phase 1 is test-mode only. Do not provide live keys or create live charges. The
integration intentionally has no Stripe Tax, invoices, subscriptions, saved
cards, or Connect behavior.

## 1. Application environment

Copy the tracked placeholders and edit only the ignored local file:

```bash
npm ci
cp .env.example .env.local
```

Configure these exact application variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_your-test-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-test-webhook-secret
STRIPE_PRICE_INTRO_ID=price_your-349-usd-test-price
STRIPE_PRICE_STANDARD_ID=price_your-399-usd-test-price
APP_DEMO_MODE=false
```

| Variable | Exposure and requirement |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible project URL. Use the same project as the server credentials. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible publishable key. Do not substitute the service-role key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret. Server-only claim, Checkout repository, and webhook persistence access. |
| `NEXT_PUBLIC_APP_URL` | Exact HTTP(S) origin used in Checkout return URLs; no path, credentials, or trailing path. |
| `STRIPE_SECRET_KEY` | Secret/restricted secret from a Stripe testing environment. Runtime rejects live and publishable keys. |
| `STRIPE_WEBHOOK_SECRET` | Endpoint-specific test signing secret beginning with the documented placeholder prefix. The CLI listener and hosted endpoint have different values. |
| `STRIPE_PRICE_INTRO_ID` | One-time test Price for $349 USD, used for the first 100 Checkout reservations. |
| `STRIPE_PRICE_STANDARD_ID` | One-time test Price for $399 USD, used after the introductory allocation. |
| `APP_DEMO_MODE` | Local review only. Set to `true` only with `NODE_ENV !== "production"`; leave `false` or unset in every deployment. |

Only variables beginning with `NEXT_PUBLIC_` are sent to browser bundles.
Never add a secret to that namespace. Keep deployment secrets in the host's
encrypted environment settings, never source control, screenshots, tickets,
or client-side code.

Run the app and checks:

```bash
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
npm ls --all
git diff --check
```

## 2. Supabase database

### Local migration verification

Use the current CLI help rather than assuming flags:

```bash
npx supabase --help
npx supabase start
npx supabase db reset
npx supabase migration list --local
```

`db reset` recreates the local database and applies every tracked file in
`supabase/migrations` in timestamp order. The local stack is development-only:
it has default credentials and no production-grade TLS or rate limiting, so
never expose it to external traffic.

### Apply to a hosted project

Mason must create or choose the hosted project and run this only after local
verification:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

Review the dry run before the push. Do not use `db reset --linked`; it destroys
remote data. Do not use `--include-seed` for a production project. After the
push, run Supabase Security Advisor and confirm that every `public` table has
RLS enabled.

The migration chain creates `profiles`, `engagements`, `vehicle_briefs`,
`status_updates`, `stripe_events`, `admin_users`, and `brief_drafts`. Customer
policies scope records through `engagements.user_id = auth.uid()`.
`stripe_events` grants no browser role access and has no browser policy.
Security-definer authorization helpers live in the non-exposed `private`
schema with an empty `search_path`. No policy uses `user_metadata` or
`raw_user_meta_data`.

## 3. Hosted Supabase Auth and redirects

In the hosted Dashboard:

1. Open **Authentication → Providers → Email**. Enable email sign-in and
   require email confirmation.
2. Open **Authentication → URL Configuration**.
3. Set **Site URL** to the canonical deployed origin, for example
   `https://carbuyerbots.com`.
4. Add these exact **Additional Redirect URLs**, replacing only the deployed
   origin:
   - `http://localhost:3000/auth/callback`
   - `https://<deployed-origin>/auth/callback`
5. For each separate staging host, add its exact `/auth/callback` URL. Avoid a
   broad wildcard in production.
6. Keep the Magic Link email template's verified confirmation URL behavior.
   If customizing the template to honor `emailRedirectTo`, use Supabase's
   `{{ .RedirectTo }}`/`{{ .ConfirmationURL }}` variables, not an untrusted
   query string assembled in email HTML.

The app sends `emailRedirectTo` as
`<current-origin>/auth/callback?next=<safe-internal-path>`. Supabase requires
the callback origin/path to be allowlisted; query parameters do not change
the allowlisted path. The callback exchanges the PKCE code server-side,
fetches the current user, requires `email_confirmed_at`, and claims only paid,
or refunded unclaimed engagements with the same normalized verified email.
Authenticated portal and onboarding entry repeats this reconciliation after a
fresh confirmed `getUser` check. Fulfillment also links a paid engagement when
an exact-email profile already exists, so callback-before-webhook and
webhook-before-callback delivery converge without trusting session display
data.

Before deployment, configure a trusted custom SMTP provider, disable provider
link tracking, choose a short magic-link/OTP expiry, and review auth rate
limits. Email security scanners can consume one-time links; test the actual
mail system used by the deployment.

## 4. Assign an admin or operator

Admin assignment has two coordinated parts:

1. protected Supabase Auth `app_metadata` (stored as
   `auth.users.raw_app_meta_data`), set only through an admin API; and
2. the RLS-protected `public.admin_users` row, which is the database
   authorization source of truth.

Never put a role in `user_metadata`/`raw_user_meta_data`; users can edit that
field. First have the staff member complete a magic-link sign-in, then copy
their Auth user UUID from **Authentication → Users**.

From a one-off, trusted server/admin script—not a browser—use the existing
server-only service-role client:

```ts
const { error } = await supabase.auth.admin.updateUserById(
  "<auth-user-uuid>",
  { app_metadata: { role: "admin" } },
);
if (error) throw error;
```

Use `role: "operator"` for an operator. This admin API operation updates
protected `raw_app_meta_data`; never log the service-role key. Then, in the
hosted SQL editor, add the matching row:

```sql
insert into public.admin_users (user_id, role, active)
values ('<auth-user-uuid>'::uuid, 'admin', true)
on conflict (user_id) do update
set role = excluded.role,
    active = excluded.active,
    updated_at = timezone('utc', now());
```

Use only `admin` or `operator`, and make the values agree. Verify the user can
open `/admin` and a normal customer receives a not-found response. To revoke
access, set `admin_users.active = false` first, remove the protected app role
through `auth.admin.updateUserById`, and revoke the user's sessions. JWT claims
are not instantly refreshed, while the active database row is checked on
every admin request and by RLS.

## 5. Stripe testing environment

### Products and one-time Prices

In a Stripe sandbox or Dashboard test mode:

1. Confirm the Dashboard is showing test data, not live mode.
2. Create one Product named `CarBuyerBots buying service`.
3. Create two **one-time**, flat-rate USD Prices on that Product:
   - $349.00 introductory service fee
   - $399.00 standard service fee
4. Copy each generated `price_…` test ID into
   `STRIPE_PRICE_INTRO_ID` and `STRIPE_PRICE_STANDARD_ID`.
5. Use a test secret or restricted-test secret in `STRIPE_SECRET_KEY`.

Or, with that test key already in `.env.local`, create the same catalog
without using the Dashboard:

```bash
npm run bootstrap:stripe
```

The script refuses live keys, does not enable Stripe Tax, and prints the
Price IDs to paste. See `docs/stripe-integration-plan.md` for the sandbox
notes and the reserved (unwired) invoicing path.

Do not create recurring Prices, enable automatic tax, generate invoices,
enable payment-method saving, or configure connected-account transfers. The
server creates only Stripe-hosted Checkout Sessions with `mode: "payment"` and
one configured Price. The database reserves the smallest available
introductory slot from 1 through 100 under an advisory transaction lock and
stores the selected Price ID, amount, and currency as an immutable pending
snapshot. A same-email retry within 23 hours reuses that pending engagement and
its engagement-derived Stripe idempotency key instead of consuming another
slot. Once Stripe creates the Session, the server idempotently attaches its
test Session ID before returning the Checkout URL. Paid and refunded
engagements retain their slot. An expired, still-pending Checkout releases it
for the next reservation.

### Local webhook forwarding

Install and authenticate the Stripe CLI against the intended testing
environment, then run the app and listener in separate terminals:

```bash
stripe login
npm run dev
stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired,charge.refunded \
  --forward-to localhost:3000/api/stripe/webhook
```

Copy the listener's displayed test signing secret into
`STRIPE_WEBHOOK_SECRET` for that local process, restart `npm run dev`, and
leave the listener running. Do not reuse this CLI secret for the hosted
endpoint.

The CLI can emit a synthetic test fixture:

```bash
stripe trigger checkout.session.completed
```

That generic fixture validates forwarding and signature handling, but it does
not contain an app-created pending engagement and may intentionally receive a
non-2xx fulfillment response. For end-to-end fulfillment, start Checkout from
the local app and complete Stripe's test checkout so its Session metadata and
pending engagement match. No real money moves in a testing environment.

### Hosted test webhook

In Stripe Workbench while test data/sandbox is selected:

1. Create an account webhook destination, not a connected-account destination.
2. Set the public HTTPS URL to
   `https://<deployed-origin>/api/stripe/webhook`.
3. Subscribe only to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
   - `charge.refunded`
4. Copy that endpoint's test signing secret into the deployment's
   `STRIPE_WEBHOOK_SECRET`.
5. Send a test event and confirm a 2xx response for a valid app-created test
   Session. Duplicate delivery must remain a 2xx no-op.

All supported events are signature-verified against the raw request body.
Fulfillment rejects live events, non-test Session IDs, non-payment Sessions,
unpaid Sessions, mismatched engagement metadata, and any amount, currency, or
Price mismatch with the immutable reservation. The redirect success page is
informational and never grants access or marks payment paid. If authentication
finishes before fulfillment, the portal says payment is processing and offers
an explicit status check; each check reconciles again.

`checkout.session.expired` is the durable abandoned-Checkout cleanup path. It
idempotently marks only the matching pending engagement failed and releases
its introductory slot. Do not delete paid or refunded rows or reclaim their
slots.

If Stripe definitively rejects Session creation because the request,
credentials, or account permissions are invalid, the server marks only an
unattached pending reservation failed and releases its slot. Network errors,
timeouts, rate limits, and unknown provider responses are ambiguous: the
reservation remains pending, and a retry uses the same engagement and
idempotency key so Stripe can return the same Session.

Before public launch, configure infrastructure-level rate limits for
`POST /api/checkout` by source and normalized email (and for passwordless email
requests) at the deployment edge or API gateway. Database locking and
same-email reuse prevent over-allocation, but they are not abuse controls and
do not replace edge limits.

Also reconcile unresolved pending reservations before launch. For each pending
row older than 23 hours, search Stripe test request logs and Sessions by the
`checkout-engagement-<engagement UUID>` idempotency key, client reference, and
metadata. Replay a valid Session's webhook or its expiration event. Only after
Stripe logs definitively show that no Session was created may an operator use
the service-role-only `fail_checkout_reservation` RPC to release an unattached
row. Attached, paid, and refunded rows are not eligible for that release RPC.

For `charge.refunded`, only a test-mode charge with `refunded=true` is modeled.
The event transaction matches the PaymentIntent, marks the engagement
refunded, stops paid-only customer actions, and writes one visible “Payment
refunded” audit update. Duplicate full-refund deliveries do not create
duplicate updates. Partial refund events (`refunded=false`) are recorded and
otherwise ignored; subscriptions, invoices, and credit-balance behavior remain
out of scope.

## 6. Local review without Supabase

Set only:

```bash
APP_DEMO_MODE=true npm run dev
```

Review `/preview/onboarding`, `/preview/portal`, `/preview/admin`, and
`/preview/admin/engagements/a6204b70-c308-40e8-b87f-30843d48cb79`.
These non-production fixtures are fictional and isolated from service-role and
Stripe write modules. Intake interaction is in memory; portal sign-out and
admin mutation controls are disabled. All preview routes are `noindex`, absent
from the sitemap, and return 404 when the flag is absent or
`NODE_ENV=production`.

Never set `APP_DEMO_MODE=true` in a hosted environment. It is local review
only, not a seed-data system, staging authentication bypass, or QA account.

## 7. Deployment checklist

- [ ] `npm test`, lint, typecheck, build, dependency-tree, and diff checks pass.
- [ ] A separate hosted Supabase project exists and all migrations were
      reviewed, dry-run, applied, and listed in migration history.
- [ ] Security Advisor is reviewed; all public tables show RLS enabled;
      customer reads are owner-scoped; `stripe_events` has no browser access.
- [ ] The publishable key is browser-visible; the Supabase service-role key and
      Stripe keys exist only in encrypted server environment settings.
- [ ] Email confirmation is required; production Site URL and exact local,
      staging, and deployed `/auth/callback` redirects are configured.
- [ ] Admin staff have matching protected `app_metadata` and active
      `admin_users` rows; no authorization uses `user_metadata`.
- [ ] The two one-time USD Prices and endpoint are in a Stripe testing
      environment; only the four supported Checkout/refund events are
      registered.
- [ ] The hosted webhook uses its own test signing secret and a public HTTPS
      `/api/stripe/webhook` URL.
- [ ] `APP_DEMO_MODE` is unset or `false` in deployment settings.
- [ ] `robots.txt` blocks auth, customer, checkout, admin, API, and preview
      surfaces; the sitemap contains only the public landing page.
- [ ] A test-mode Checkout, webhook retry/duplicate, confirmed magic link,
      owner claim, onboarding submission, portal read, and admin transition
      have been verified without live keys or live charges.
- [ ] Stripe Tax, invoices, subscriptions, saved cards, and Connect remain
      disabled and absent from Checkout parameters.
