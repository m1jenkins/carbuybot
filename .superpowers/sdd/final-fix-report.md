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
