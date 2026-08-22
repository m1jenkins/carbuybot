# Final Fix Report

## Status

Implemented the complete final-review wave on the existing
`cursor/customer-portal-admin-7bf7` branch without switching branches,
pushing, applying a remote migration, or creating a Stripe charge.

The additive migration was created only after checking current CLI help:

```text
npx supabase migration --help
npx supabase migration new --help
npx supabase migration new final_review_fixes
```

Created:
`supabase/migrations/20260822100528_final_review_fixes.sql`

## Implemented findings

- Payment/auth races now converge in either delivery order:
  - fulfillment links the exact normalized-email profile when it already exists;
  - fresh confirmed-user reconciliation runs at callback, portal, and onboarding entry;
  - paid and refunded unclaimed engagements are claimable;
  - callback-before-webhook enters a truthful processing state with an explicit status check.
- Fulfillment compares the Stripe amount, currency, Price, email, engagement, and Session to the immutable pending snapshot and no longer overwrites expected amount/currency/email.
- Checkout pricing uses one service-role-only security-invoker reservation RPC:
  - advisory transaction lock;
  - smallest free `intro_slot` in `1..100`;
  - unique constrained slot;
  - server-provided Price IDs with transaction-selected immutable amount/currency;
  - one atomic pending-engagement insert.
- `checkout.session.expired` idempotently marks only matching pending rows failed and releases introductory slots. Paid/refunded rows retain slots.
- Fully refunded `charge.refunded` events reconcile by event ID and PaymentIntent in one service-role-only transaction, retain claims/slots, stop paid-only work, and write one visible refund audit update. Partial refunds are recorded without changing engagement state.
- Admin transitions require paid state; operational transitions require a stored brief; `awaiting_brief -> brief_submitted` is customer-finalization-only; paid pre-brief cancellation remains allowed. TypeScript, UI options, and SQL enforce the same rules.
- Finalization retains protected draft baselines and resets the per-revision cursor to the first question while preserving advisory-lock concurrency and retry idempotency.
- Admin history pages canonicalize out-of-range requests.
- Public copy now states Checkout occurs before the vehicle brief and describes the full-refund guarantee accurately.
- Node is pinned to `>=22.14.0 <23.0.0`, including the verified local `v22.14.0`.
- Setup/design documentation covers retained baselines, supported refund/expiry events, and abandoned Checkout cleanup.

## TDD evidence

Initial focused RED run:

```text
npm test -- app/api/checkout/route.test.ts lib/stripe/repository.test.ts lib/stripe/stripe.test.ts app/auth/callback/route.test.ts "app/(customer)/portal/page.test.tsx" app/checkout/checkout-pages.test.tsx lib/supabase/migration-runtime.test.ts lib/supabase/admin-migration-runtime.test.ts app/admin/engagements/\[id\]/actions.test.ts app/admin/admin-pages.test.tsx components/landing/landing-page.test.tsx lib/security/static-regressions.test.ts lib/supabase/migration-security.test.ts lib/supabase/admin-migration-security.test.ts lib/domain/validation.test.ts
```

Result: expected failure, 31 failed and 132 passed. Failures directly
identified the missing reservation/refund/expiry RPCs, callback processing
state, profile linking, immutable snapshot checks, admin guards, revision reset,
copy, history redirect, and Node/docs updates.

Focused GREEN run:

```text
npm test -- lib/supabase/migration-runtime.test.ts lib/supabase/admin-migration-runtime.test.ts lib/supabase/migration-security.test.ts lib/supabase/admin-migration-security.test.ts lib/stripe/stripe.test.ts lib/stripe/repository.test.ts app/api/checkout/route.test.ts app/auth/callback/route.test.ts "app/(customer)/portal/page.test.tsx" "app/(customer)/onboarding/page.test.tsx" app/checkout/checkout-pages.test.tsx app/admin/engagements/\[id\]/actions.test.ts app/admin/admin-pages.test.tsx components/landing/landing-page.test.tsx lib/security/static-regressions.test.ts lib/domain/validation.test.ts
```

Result: 16 files passed, 168 tests passed.

Self-review RED/GREEN:

```text
npm test -- lib/domain/admin-engagement.test.ts lib/stripe/stripe.test.ts lib/supabase/migration-security.test.ts
```

Result before fixes: expected 3 failures covering SQL backfill narrowing,
non-payment expiry, and TypeScript admin-context parity.

```text
npm test -- lib/domain/admin-engagement.test.ts lib/stripe/stripe.test.ts lib/supabase/migration-security.test.ts components/admin/admin-dashboard.test.tsx app/admin/engagements/\[id\]/actions.test.ts
```

Result after fixes: 5 files passed, 60 tests passed.

## Final verification

```text
npm test
```

Result: exit 0; 33 files passed, 247 tests passed.

```text
npm run lint
```

Result: exit 0; no ESLint findings.

```text
npm run typecheck
```

Result: exit 0; `tsc --noEmit` clean.

```text
npm run build
```

Result: exit 0; Next.js 16.3.2 production build compiled, typechecked, and
generated all static pages.

```text
npm ls --all
```

Result: exit 0; complete dependency tree resolved. The installed tree reports
platform/tooling optional dependencies as unmet and two pre-existing
Sharp/WASM packages as extraneous, but npm returned success and the production
build passed.

```text
git diff --check
git diff --check 51e6494..HEAD
```

Result: both exit 0.

## Security notes

- Raw request-body Stripe signature verification remains unchanged.
- Event and object live-mode guards remain mandatory.
- Checkout remains one-time hosted `mode: "payment"` with no Tax, invoices,
  subscriptions, saved cards, payment-method configuration, or Connect fields.
- Public payment RPCs are `security invoker`, fixed-search-path, revoked from
  browser roles, and granted only to `service_role`.
- The browser-exposed answer-save RPC remains `security invoker` and delegates
  to one fixed-search-path private definer that repeats authenticated ownership,
  paid-state, and editable-workflow checks. Direct authenticated draft writes
  and write policies are removed.
- No authorization uses `user_metadata`; profile creation/claiming follows a
  fresh `getUser` check with confirmed exact normalized email.
- Stripe event insertion and each fulfillment, expiry, or refund state change
  are one rollback-safe idempotent transaction.
- Success-page Session display never grants access or marks payment state.

## Concerns

- No hosted Supabase project or Stripe endpoint is connected here, so no remote
  migration, hosted webhook delivery, or end-to-end sandbox Checkout/refund was
  run. PGlite transaction/security tests and route tests cover those paths
  locally without taking a charge.
- A branch-wide `git diff --check origin/main...HEAD` also reports a pre-existing
  final blank line in
  `docs/superpowers/plans/2026-08-22-phase-1-customer-portal.md`. That prohibited
  planning artifact was intentionally not modified. The complete final-fix
  range and working-tree diff checks are clean.

## Remaining Important findings — 2026-08-22

### Status and commits

Implemented the two follow-up findings without switching branches, pushing,
applying a remote migration, or modifying planning artifacts:

- `eb05473 Preserve pending engagement callback context`
- `c422926 Make Checkout reservations retry-safe`
- `908b5c8 Test exact engagement refresh after fulfillment`

The additive migration was created after checking the current CLI help:

```text
npx supabase migration new --help
npx supabase migration new harden_checkout_reservations
```

Created:
`supabase/migrations/20260822103250_harden_checkout_reservations.sql`

The verified paid Checkout Session now supplies its metadata engagement UUID
to the magic-link destination only when it is a valid UUID and matches the
Session client reference. Callback and portal processing flows preserve that
specific safe internal target. A missing target is not replaced by an older
visible engagement; after reconciliation makes the target RLS-visible, refresh
loads that exact engagement. The UUID is never displayed as account data and
never grants access.

Checkout creation now uses
`checkout-engagement-<engagement UUID>` as the Stripe idempotency key. The
reservation transaction reuses a same-email pending row created within 23
hours under the existing allocation lock. The server attaches the returned
`cs_test_…` Session ID transactionally and idempotently before returning its
URL. Only Stripe invalid-request, authentication, and permission errors invoke
the service-role-only unattached-reservation failure RPC. Connection, timeout,
rate-limit, generic, attachment, and unknown failures retain the reservation
for retry or manual reconciliation. Expiration remains the cleanup path for
attached pending Sessions; paid and refunded slots remain durable.

Landing and setup wording now assigns the introductory price to the first 100
Checkout reservations. Setup documentation requires infrastructure rate
limits and documents pre-launch inspection and reconciliation of ambiguous
pending reservations.

### TDD and verification evidence

Initial focused RED:

```text
npm test -- --run "app/checkout/checkout-pages.test.tsx" "app/auth/callback/route.test.ts" "app/(customer)/portal/page.test.tsx" "app/api/checkout/route.test.ts" "lib/stripe/repository.test.ts" "lib/supabase/migration-runtime.test.ts" "lib/supabase/migration-security.test.ts"
```

Result: expected exit 1; 7 files failed; 16 tests failed and 75 passed. The
failures reproduced older-engagement fallback, missing metadata destination,
duplicate same-email reservations, absent Stripe idempotency/attachment,
missing definitive failure release, and missing RPC grants.

Callback GREEN:

```text
npm test -- --run "app/checkout/checkout-pages.test.tsx" "app/auth/callback/route.test.ts" "app/(customer)/portal/page.test.tsx"
```

Result: exit 0; 3 files passed; 26 tests passed.

Reservation GREEN:

```text
npm test -- --run "app/api/checkout/route.test.ts" "lib/stripe/repository.test.ts" "lib/supabase/migration-runtime.test.ts" "lib/supabase/migration-security.test.ts"
```

Result: exit 0; 4 files passed; 65 tests passed.

Combined focused GREEN:

```text
npm test -- --run "app/checkout/checkout-pages.test.tsx" "app/auth/callback/route.test.ts" "app/(customer)/portal/page.test.tsx" "app/api/checkout/route.test.ts" "lib/stripe/repository.test.ts" "lib/stripe/stripe.test.ts" "lib/supabase/migration-runtime.test.ts" "lib/supabase/migration-security.test.ts" "components/landing/landing-page.test.tsx"
```

Result: exit 0; 9 files passed; 122 tests passed.

Exact-target self-review:

```text
npm test -- --run "app/(customer)/portal/page.test.tsx"
```

Result: exit 0; 1 file passed; 9 tests passed, including refresh selecting the
newly visible exact engagement rather than an older row.

```text
npm test
```

Result: exit 0; 33 files passed; 264 tests passed.

```text
npm run lint
npm run typecheck
npm run build
npm ls --all
```

Results: all exit 0. ESLint reported no findings; `tsc --noEmit` was clean;
Next.js 16.3.2 compiled and generated all pages; npm resolved the dependency
tree with the same optional-platform and pre-existing extraneous package notes
recorded above.

```text
git diff --check
```

Result before report append: exit 0.

### Security notes and concerns

- Raw-body Stripe signature verification, event/object test-mode guards,
  immutable amount/currency/Price checks, and one-time `mode: "payment"`
  Checkout remain unchanged.
- No Tax, invoice, subscription, saved-payment-method, or Connect behavior was
  added.
- All reservation lifecycle RPCs are fixed-search-path `security invoker`
  functions revoked from public browser roles and granted only to
  `service_role`; PGlite verifies authenticated denial.
- No hosted Stripe or Supabase environment was connected, so remote migration
  and end-to-end sandbox delivery were not run. Route, static security, and
  PGlite transaction tests cover the paths locally without taking a charge.
- Infrastructure rate limiting remains a deployment prerequisite, not an
  application feature in this change. Pending rows older than the 23-hour
  retry window require the documented Stripe-log reconciliation before any
  manual release.

## Final Important pricing-copy finding — 2026-08-22

### Status and commit

Implemented and committed:

- `e4cd895 Qualify introductory pricing claims`

Audited all tracked `$349`, `349.00`, and `34900` occurrences. Public landing
copy, metadata descriptions, Open Graph, Twitter, JSON-LD, comparison pricing,
FAQ, guarantee, trust rail, and mobile CTA now distinguish the $349
introductory price from the $399 standard price. Guarantee language compares
savings with the customer's actual service fee.

The Product JSON-LD now uses an `AggregateOffer` with a `$349.00` low price,
`$399.00` high price, two explicitly described child offers, and organization
price range `$349–$399`. It no longer publishes one unconditional $349 Offer.

Remaining source occurrences are transactional selected-price displays,
database amount snapshots, explicitly qualified setup documentation, tests, or
prohibited planning/design artifacts. No planning artifact was modified.

### TDD and verification evidence

Focused RED:

```text
npm test -- --run "components/landing/landing-page.test.tsx"
```

Result before implementation: expected exit 1; 1 file failed; 3 tests failed
and 2 passed. Failures identified unconditional rendered/static `$349 flat`
claims and one-price metadata/structured data.

Focused GREEN:

```text
npm test -- --run "components/landing/landing-page.test.tsx"
```

Result: exit 0; 1 file passed; 5 tests passed. Coverage renders the landing
copy, statically scans both public marketing sources for fixed claims, checks
fee-relative guarantee wording, inspects metadata, renders and parses JSON-LD,
and asserts the aggregate range and qualified offers.

```text
npm test
```

Result: exit 0; 33 files passed; 267 tests passed.

```text
npm run lint
npm run typecheck
npm run build
git diff --check
git diff --check HEAD~1..HEAD
```

Results: all exit 0. ESLint reported no findings, `tsc --noEmit` was clean,
Next.js 16.3.2 compiled and generated all pages, and both working-tree and
committed-range diff checks passed.

### Concerns

- No deployed social-card crawler or search-engine rich-results validator was
  available. Rendered JSON parsing and structural assertions validate the
  local output.
- Actual `$349.00` amounts remain visible for engagements and Checkout
  Sessions that selected the introductory snapshot; those are transaction
  facts, not unconditional public pricing claims.
