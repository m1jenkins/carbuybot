# Phase 1 Customer Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a unified Next.js application with test-mode Stripe Checkout, webhook-verified fulfillment, Supabase magic-link onboarding, a customer status portal, and an RLS-protected admin dashboard.

**Architecture:** Next.js App Router owns the public, customer, admin, and API surfaces. Stripe Checkout handles payment while a signature-verified webhook writes fulfillment to Supabase; authenticated customers claim paid engagements only when their verified Supabase email matches Checkout. Focused server modules isolate external providers, validation, authorization, and workflow transitions.

**Tech Stack:** Latest stable Next.js, React, TypeScript, Stripe Node SDK, `@supabase/ssr`, `@supabase/supabase-js`, Zod, Vitest, Testing Library, Postgres/Supabase RLS.

## Global Constraints

- Use Stripe test or restricted test keys only; reject live secret keys at runtime.
- Do not enable Stripe Tax, subscriptions, saved cards, invoices, or Connect.
- Treat `checkout.session.completed` as the fulfillment source of truth.
- A Checkout success URL never grants customer or admin access.
- Enable RLS on every table in the exposed `public` schema.
- Derive admin access from `admin_users` and protected app metadata, never `user_metadata`.
- Keep Stripe and Supabase privileged keys in server-only modules.
- Preserve the landing page's Inter typography, warm paper/near-black palette, editorial photography, hairlines, copy, and motion.
- Reserve teal for money semantics; use no shadows and no panel radius.

---

### Task 1: Next.js Foundation and Landing Migration

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `components/landing/landing-page.tsx`
- Create: `components/landing/landing-motion.tsx`
- Create: `components/checkout/checkout-form.tsx`
- Move: `media/**` to `public/media/**`
- Move: `logo.svg`, `og.jpg`, `robots.txt`, `sitemap.xml` to `public/`
- Remove: `index.html`
- Modify: `.gitignore`
- Test: `components/landing/landing-page.test.tsx`

**Interfaces:**
- Produces: `CheckoutForm({ defaultEmail?: string })`
- Produces: `LandingMotion()` client enhancement with reduced-motion support
- Produces: `POST /api/checkout` request contract `{ email: string }`

- [ ] **Step 1: Write the failing landing smoke test**

```tsx
render(<LandingPage />);
expect(screen.getByRole("heading", { name: /let a bot haggle/i })).toBeInTheDocument();
expect(screen.getAllByRole("button", { name: /start my search/i }).length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/landing/landing-page.test.tsx`

Expected: FAIL because the Next.js app and component do not exist.

- [ ] **Step 3: Install the application and test dependencies**

Run:

```bash
npm install next@latest react@latest react-dom@latest stripe@latest @supabase/ssr@latest @supabase/supabase-js@latest zod@latest
npm install -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest vitest@latest jsdom@latest @vitejs/plugin-react@latest @testing-library/react@latest @testing-library/jest-dom@latest eslint@latest eslint-config-next@latest
```

Expected: package manifests are generated with no critical audit finding.

- [ ] **Step 4: Migrate the landing page**

Convert the current semantic sections into `LandingPage`, keep factual copy and media, move CSS tokens and responsive rules into `app/globals.css`, and replace the Web3Forms form with:

```tsx
<CheckoutForm />
```

`CheckoutForm` posts `{ email }` to `/api/checkout` and navigates only to the returned Stripe-hosted URL.

- [ ] **Step 5: Run the landing test**

Run: `npm test -- components/landing/landing-page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json vitest.config.ts vitest.setup.ts app components public .gitignore index.html media logo.svg og.jpg robots.txt sitemap.xml
git commit -m "Migrate the landing page to Next.js"
```

### Task 2: Domain Validation and Supabase Security Model

**Files:**
- Create: `lib/domain/engagement.ts`
- Create: `lib/domain/brief.ts`
- Create: `lib/domain/validation.test.ts`
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`
- Create: `lib/supabase/claim.ts`
- Create: `lib/supabase/database.types.ts`
- Create: `supabase/config.toml`
- Create: `supabase/migrations/*_phase_1_portal.sql` via `supabase migration new phase_1_portal`
- Create: `.env.example`

**Interfaces:**
- Produces: `briefSchema` and `BriefInput`
- Produces: `canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean`
- Produces: `createBrowserClient()`, `createServerClient()`, `createAdminClient()`
- Produces: `claimPaidEngagements(userId: string, verifiedEmail: string): Promise<number>`

- [ ] **Step 1: Write failing domain tests**

```ts
expect(briefSchema.safeParse(validBrief).success).toBe(true);
expect(briefSchema.safeParse({ ...validBrief, postalCode: "12" }).success).toBe(false);
expect(canTransition("brief_submitted", "in_review")).toBe(true);
expect(canTransition("completed", "searching")).toBe(false);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- lib/domain/validation.test.ts`

Expected: FAIL because schemas and transition helpers do not exist.

- [ ] **Step 3: Implement schemas and focused clients**

Use Zod to normalize email, enforce U.S. ZIP formats, positive budget cents, bounded search radius, year ranges, consent, and allowed enum values. Put `SUPABASE_SERVICE_ROLE_KEY` access only in `lib/supabase/admin.ts` with `import "server-only"`.

- [ ] **Step 4: Create and implement the migration**

Run: `npx supabase --help` and `npx supabase migration new phase_1_portal`.

The migration creates `profiles`, `engagements`, `vehicle_briefs`, `status_updates`, `stripe_events`, and `admin_users`; adds checks and indexes on owner IDs, email, Checkout Session ID, status, and creation time; enables RLS on every table; and creates `private.is_admin()` as a non-exposed `security definer` helper with a fixed `search_path`.

Customer policies use `auth.uid()` through engagement ownership. Admin policies call `private.is_admin()`. `stripe_events` has no browser policies.

- [ ] **Step 5: Implement secure engagement claiming**

`claimPaidEngagements` uses the service-role client only after `supabase.auth.getUser()` succeeds, normalizes the verified auth email, upserts the profile, and updates only rows where `customer_email` matches, `payment_status = 'paid'`, and `user_id IS NULL`.

- [ ] **Step 6: Run domain tests**

Run: `npm test -- lib/domain/validation.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib supabase .env.example
git commit -m "Add Supabase schema and portal security model"
```

### Task 3: Test-Mode Stripe Checkout and Webhook Fulfillment

**Files:**
- Create: `lib/env.ts`
- Create: `lib/stripe/client.ts`
- Create: `lib/stripe/pricing.ts`
- Create: `lib/stripe/fulfillment.ts`
- Create: `lib/stripe/stripe.test.ts`
- Create: `app/api/checkout/route.ts`
- Create: `app/api/stripe/webhook/route.ts`
- Create: `app/checkout/success/page.tsx`
- Create: `app/checkout/cancel/page.tsx`
- Create: `components/auth/magic-link-form.tsx`

**Interfaces:**
- Produces: `getStripe(): Stripe` that rejects `sk_live_` and `rk_live_`
- Produces: `choosePrice(paidCount: number): { priceId: string; label: "intro" | "standard" }`
- Produces: `fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<"processed" | "duplicate">`
- Consumes: `POST /api/checkout` contract `{ email: string }`

- [ ] **Step 1: Write failing Stripe tests**

```ts
expect(() => assertTestStripeKey("sk_live_example")).toThrow(/test-mode/i);
expect(choosePrice(99).label).toBe("intro");
expect(choosePrice(100).label).toBe("standard");
await expect(processEvent(completedEvent)).resolves.toBe("processed");
await expect(processEvent(completedEvent)).resolves.toBe("duplicate");
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- lib/stripe/stripe.test.ts`

Expected: FAIL because Stripe modules do not exist.

- [ ] **Step 3: Implement Checkout creation**

Validate email server-side, count paid engagements, insert a pending engagement, and call `stripe.checkout.sessions.create` with:

```ts
{
  mode: "payment",
  customer_email: email,
  customer_creation: "always",
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${appUrl}/checkout/cancel`,
  client_reference_id: engagement.id,
  metadata: { engagement_id: engagement.id, price_id: priceId }
}
```

Do not include `automatic_tax`.

- [ ] **Step 4: Implement webhook fulfillment**

Read the raw body, verify `stripe-signature`, insert `event.id` into `stripe_events`, and return success for duplicate IDs. For a paid `checkout.session.completed` or `checkout.session.async_payment_succeeded`, update only the matching metadata engagement with normalized email, Stripe identifiers, amount snapshot, `payment_status = 'paid'`, and `workflow_status = 'awaiting_brief'`. Return non-2xx for database failure so Stripe retries.

- [ ] **Step 5: Implement success and cancel pages**

The success page may retrieve the Checkout Session server-side to render payment context and prefill email, but it never writes fulfillment or creates access. It renders the magic-link form when the session is paid and a processing state otherwise.

- [ ] **Step 6: Run Stripe tests**

Run: `npm test -- lib/stripe/stripe.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/env.ts lib/stripe app/api app/checkout components/auth
git commit -m "Add verified Stripe Checkout fulfillment"
```

### Task 4: Magic-Link Authentication and Vehicle Onboarding

**Files:**
- Create: `app/auth/callback/route.ts`
- Create: `app/sign-in/page.tsx`
- Create: `app/(customer)/layout.tsx`
- Create: `app/(customer)/onboarding/page.tsx`
- Create: `app/(customer)/onboarding/actions.ts`
- Create: `components/onboarding/onboarding-form.tsx`
- Create: `components/onboarding/onboarding-form.test.tsx`
- Create: `middleware.ts`

**Interfaces:**
- Consumes: `claimPaidEngagements(userId, verifiedEmail)`
- Produces: `saveBrief(input: BriefInput & { intent: "draft" | "submit" })`
- Produces: authenticated customer route contract

- [ ] **Step 1: Write failing onboarding tests**

```tsx
render(<OnboardingForm engagementId="eng_1" initialBrief={null} />);
expect(screen.getByLabelText(/make/i)).toBeRequired();
await user.click(screen.getByRole("button", { name: /submit brief/i }));
expect(await screen.findByText(/enter the make/i)).toBeVisible();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- components/onboarding/onboarding-form.test.tsx`

Expected: FAIL because the onboarding form does not exist.

- [ ] **Step 3: Implement magic-link callback**

Exchange the auth code for a session, call `getUser()`, claim paid engagements using the verified email, and redirect to `/onboarding` for incomplete briefs or `/portal` otherwise. Reject missing or unverified identities.

- [ ] **Step 4: Implement onboarding**

Render five clear sections in one responsive form. Save drafts without changing workflow state. On submit, validate the complete payload, upsert `vehicle_briefs`, set `onboarding_completed_at`, transition to `brief_submitted`, and insert the first customer-visible status update in one server action.

- [ ] **Step 5: Run onboarding tests**

Run: `npm test -- components/onboarding/onboarding-form.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/auth app/sign-in app/\(customer\) components/onboarding middleware.ts
git commit -m "Add magic-link onboarding flow"
```

### Task 5: Customer Status Portal

**Files:**
- Create: `app/(customer)/portal/page.tsx`
- Create: `components/portal/portal-shell.tsx`
- Create: `components/portal/status-timeline.tsx`
- Create: `components/portal/brief-summary.tsx`
- Create: `components/portal/portal-shell.test.tsx`

**Interfaces:**
- Consumes: authenticated user's engagement, brief, and customer-visible status updates
- Produces: `PortalShell({ engagement, brief, updates })`

- [ ] **Step 1: Write failing portal test**

```tsx
render(<PortalShell engagement={fixtureEngagement} brief={fixtureBrief} updates={fixtureUpdates} />);
expect(screen.getByText(/brief submitted/i)).toBeVisible();
expect(screen.getByText(/2025 Genesis GV80/i)).toBeVisible();
expect(screen.queryByText(/internal only/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- components/portal/portal-shell.test.tsx`

Expected: FAIL because portal components do not exist.

- [ ] **Step 3: Implement the portal**

Load only RLS-visible rows with the authenticated server client. Show current stage, next action, brief summary, payment amount/reference, and chronological visible updates. Permit brief edits only while status is `awaiting_brief` or `brief_submitted`.

- [ ] **Step 4: Run portal tests**

Run: `npm test -- components/portal/portal-shell.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(customer\)/portal components/portal
git commit -m "Add customer status portal"
```

### Task 6: Admin Review Dashboard

**Files:**
- Create: `lib/auth/admin.ts`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/engagements/[id]/page.tsx`
- Create: `app/admin/engagements/[id]/actions.ts`
- Create: `components/admin/admin-overview.tsx`
- Create: `components/admin/engagement-table.tsx`
- Create: `components/admin/engagement-review.tsx`
- Create: `components/admin/admin-dashboard.test.tsx`

**Interfaces:**
- Produces: `requireAdmin(): Promise<{ id: string; role: "admin" | "operator" }>`
- Consumes: `canTransition(from, to)`
- Produces: `updateEngagementStatus({ engagementId, nextStatus, title, note })`

- [ ] **Step 1: Write failing admin tests**

```tsx
render(<AdminOverview engagements={fixtureQueue} />);
expect(screen.getByText(/needs review/i)).toBeVisible();
expect(screen.getByRole("link", { name: /Genesis GV80/i })).toHaveAttribute("href", "/admin/engagements/eng_1");
expect(() => validateTransition("completed", "searching")).toThrow();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- components/admin/admin-dashboard.test.tsx`

Expected: FAIL because admin modules do not exist.

- [ ] **Step 3: Implement admin authorization**

`requireAdmin` calls `getUser()`, queries the caller's own active `admin_users` row, optionally verifies protected `app_metadata.role`, and denies access before loading customer data.

- [ ] **Step 4: Implement queue and detail dashboards**

Show queue totals by state and a sortable engagement table. The detail page shows payment, customer, complete vehicle brief, and history. Status updates require a valid transition, title, and customer-visible note; the server action updates engagement state and inserts the status record.

- [ ] **Step 5: Run admin tests**

Run: `npm test -- components/admin/admin-dashboard.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/auth app/admin components/admin
git commit -m "Add admin engagement review dashboard"
```

### Task 7: Documentation, Security Review, and Full Verification

**Files:**
- Create: `README.md`
- Create: `docs/setup-phase-1-portal.md`
- Modify: `docs/design-language.md`
- Modify: `public/sitemap.xml`
- Test: all test files

**Interfaces:**
- Documents all external setup required for Supabase and Stripe test mode.

- [ ] **Step 1: Document setup**

Document environment variables, migration application, Supabase magic-link redirects, creating Stripe test Prices, registering `/api/stripe/webhook`, assigning an admin row/app metadata, and using Stripe CLI test fixtures. State that no live charge or Stripe Tax is supported.

- [ ] **Step 2: Update durable design guidance**

Add portal/admin rules to `docs/design-language.md`: status uses neutral typography and hairline progress, teal remains money-only, tables collapse accessibly, and no fake activity appears.

- [ ] **Step 3: Run static and automated verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, lint exits zero, production build completes, and diff check is empty.

- [ ] **Step 4: Review Supabase security**

Confirm every public table has RLS enabled, customer policies are owner-scoped, `stripe_events` has no browser policy, the service-role key appears only in server-only code, admin policy helpers live in `private`, and no policy references `user_metadata`.

- [ ] **Step 5: Perform responsive UI verification**

Start the app with non-production demo data only when `NODE_ENV !== "production"`, inspect landing, onboarding, portal, and admin at desktop and mobile widths, fix all observed defects in one bounded pass, then perform one confirmation pass.

- [ ] **Step 6: Commit**

```bash
git add README.md docs public/sitemap.xml
git commit -m "Document and harden Phase 1 portal"
```

