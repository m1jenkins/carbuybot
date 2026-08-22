# CarBuyerBots Phase 1 Customer Portal Design

## Goal

Turn the static CarBuyerBots site into one Next.js App Router application that takes a test-mode Stripe Checkout payment first, verifies fulfillment through Stripe webhooks, collects the buyer's vehicle brief, and gives customers and staff role-appropriate dashboards.

Phase 1 includes:

- hosted Stripe Checkout in test mode
- verified post-checkout onboarding
- Supabase passwordless magic-link access
- persisted vehicle briefs
- a customer status portal
- an admin review dashboard

Messaging, file exchange, dealer offer comparison, and negotiation automation remain later phases.

## Architecture

The repository becomes a single Next.js App Router application. The current landing page is migrated into React while preserving its editorial photography, copy, tokens, typography, and motion.

The application uses:

- Next.js server components and route handlers for trusted server work
- Stripe Checkout Sessions for payment
- a signature-verified Stripe webhook as the payment source of truth
- Supabase Postgres for application data
- Supabase Auth for email magic links
- Supabase Row Level Security on every exposed table

Public, customer, admin, and API concerns are separated into route groups and focused modules. Stripe and Supabase service-role secrets are server-only.

## Payment and Identity Flow

1. A visitor enters an email address and starts Checkout from the landing page.
2. A server route validates the email, selects the configured test Price ID, creates a pending engagement, and creates a hosted Checkout Session.
3. Checkout returns to `/checkout/success?session_id={CHECKOUT_SESSION_ID}`.
4. The success page retrieves the session server-side and shows only a pending, paid, or error state. The session URL never grants portal access.
5. `checkout.session.completed` is signature-verified and handled idempotently.
6. For a paid session, the webhook upserts the engagement by normalized Checkout email, records payment identifiers, and marks it `paid`. It does not create or trust a browser identity.
7. The customer requests a Supabase magic link for the same normalized email address.
8. After callback exchange, a server-only claim operation links paid, unclaimed engagements with the verified auth email to that user.
9. The customer is routed to onboarding if the brief is incomplete, otherwise to the portal.

No Stripe Tax, live charges, subscriptions, saved cards, invoices, or Connect behavior are included.

## Data Model

### `profiles`

- `id` references `auth.users`
- normalized `email`
- `full_name`
- timestamps

### `engagements`

- normalized Checkout email
- nullable customer/profile owner until a verified magic-link user claims it
- Stripe Checkout Session, Customer, and Payment Intent identifiers
- configured price identifier and amount snapshot
- payment status
- workflow status
- onboarding completion timestamp
- timestamps

Workflow states are `awaiting_brief`, `brief_submitted`, `in_review`, `searching`, `negotiating`, `offers_ready`, `completed`, and `cancelled`.

### `vehicle_briefs`

- one brief per engagement
- condition: new, used, or either
- make, model, year range, trim
- required and preferred colors/options
- budget ceiling
- purchase location, ZIP code, and search radius
- timeline
- trade-in details
- financing preference
- freeform notes
- consent confirmation
- timestamps

### `status_updates`

- engagement
- author
- workflow state
- customer-visible title and note
- timestamp

### `stripe_events`

- Stripe event ID primary key
- event type
- processed timestamp

This table makes webhook handling idempotent.

### `admin_users`

- user ID
- role (`admin` or `operator`)
- active flag
- timestamps

Authorization may also be mirrored into protected app metadata, but never into editable user metadata.

## Access Control

- RLS is enabled on every public table.
- Customers can select their own profile, engagements, briefs, and visible status updates.
- Claiming an engagement requires a verified Supabase identity whose normalized email exactly matches the paid Checkout email; the client cannot select an arbitrary engagement.
- Customers can create or update a brief only for their own paid engagement.
- Customers cannot set payment or workflow state.
- Admin access is derived from `admin_users` and protected server checks.
- Browser code receives only the Supabase publishable key.
- The Supabase service-role key and Stripe secret keys never leave server modules.
- Webhook processing validates Stripe signatures against the raw request body.
- Admin routes verify both an authenticated Supabase user and an active admin role.

## Customer Experience

### Checkout success

The page clearly distinguishes:

- payment confirmed and ready for sign-in
- payment processing while the webhook arrives
- payment not found or incomplete

It provides a magic-link form prefilled with the Checkout email when available.

### Onboarding

The brief is a focused multi-section form:

1. vehicle: condition, make, model, year, trim
2. must-haves: colors, options, deal-breakers
3. budget and location: ceiling, ZIP, radius
4. timing and deal structure: timeline, trade-in, financing
5. review and consent

Progress is saved as a draft. Final submission changes the engagement to `brief_submitted` and creates the first customer-visible status update.

### Customer portal

The portal shows:

- current workflow stage and plain-language next step
- vehicle brief summary
- a chronological status history
- payment reference and amount
- a safe route to edit the brief before staff review begins

It does not show fake live activity or invented dealer counts.

### Admin dashboard

The dashboard shows:

- queue counts by workflow state
- sortable engagement list
- customer, vehicle, location, age, and payment state
- engagement detail with the complete brief and status history
- controlled workflow-state updates with a required customer-visible note

Admin mutations run on the server and create auditable status records.

## Visual System

The app preserves the existing design language:

- Inter 400/500/600
- warm paper and near-black grounds
- hairlines and whitespace instead of cards and shadows
- square panels; pill controls only
- teal reserved for money semantics
- plain, concrete copy

Portal status uses typography, labels, progress rules, and neutral tones rather than introducing a generic colorful SaaS dashboard.

## Error Handling

- Checkout creation returns actionable configuration or validation errors without leaking provider details.
- Duplicate webhook delivery is successful and has no duplicate effects.
- Webhook database failure returns a retryable non-2xx response.
- Magic-link errors preserve the intended destination and show a retry action.
- Unauthenticated customer and admin routes redirect to sign-in.
- Unauthorized admin access returns a not-found or access-denied page without exposing data.
- Form validation runs client-side for usability and server-side for trust.
- Missing external credentials produce a reviewable configuration state rather than build failure.

## Testing

- unit tests for validation, price selection, workflow transitions, and authorization helpers
- route tests for Checkout creation and webhook signature/idempotency behavior
- component tests for onboarding validation and dashboard states
- a production build and lint/type check
- manual responsive checks for landing, onboarding, portal, and admin at desktop and mobile widths

External integration tests use mocks and Stripe test-mode fixtures. No live charge is created.

## Configuration and Mason-Only Setup

The repository documents placeholders for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` using a test/restricted key
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_INTRO_ID`
- `STRIPE_PRICE_STANDARD_ID`
- `NEXT_PUBLIC_APP_URL`

Mason must create or connect the Supabase project, apply the migration, configure auth redirect URLs, create Stripe test Products/Prices, and register the deployed webhook endpoint.

