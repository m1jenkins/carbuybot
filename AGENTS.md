# CarBuyerBots

Phase 1 is a Next.js App Router app: editorial landing page, test-mode Stripe
Checkout, post-checkout conversational vehicle intake, customer portal, and
admin review. Design-system source lives in `.styleseed/` and
`docs/design-language.md`. Product notes live in `carbuyerbots-plan.md`.

## Cursor Cloud specific instructions

- This is **not** a static `index.html` site. Do not serve the repo with
  `python3 -m http.server`. The former single-file landing page now lives in
  `components/landing/` and `app/globals.css`.
- Requirements: Node.js 22.14 or newer (below 23) and npm. Exact engine range
  is `>=22.14.0 <23.0.0`.
- Install and run:

  ```bash
  npm ci
  cp .env.example .env.local
  npm run dev
  ```

  Then open `http://localhost:3000/`.
- Local review without Supabase or Stripe:

  ```bash
  APP_DEMO_MODE=true npm run dev
  ```

  Fixtures: `/preview/onboarding`, `/preview/portal`, `/preview/admin`.
- Verification (run these; do not invent a different toolchain):

  ```bash
  npm test
  npm run lint
  npm run typecheck
  npm run build
  ```

- Never commit `.env`, `.env.local`, or real keys. `.env.example` is the only
  tracked env file. Never prefix a secret with `NEXT_PUBLIC_`.
- The landing checkout form starts a **test-mode** Stripe Checkout Session.
  Completing it can create a real test engagement if keys are configured.
  When walking the marketing page, fill the email field only if you intend to
  start checkout. Prefer `APP_DEMO_MODE=true` and the `/preview/*` routes for
  UI review.
- Hero thread animation, deal-sheet row reveals, and scroll plates are
  `IntersectionObserver`-driven and pause offscreen or under
  `prefers-reduced-motion`. If motion looks static, that is expected.
- Do not enable Stripe Tax, live keys, subscriptions, saved cards, or Connect.
  Phase 1 Checkout is hosted `mode: "payment"` only. Off-session invoicing is
  documented in `docs/stripe-integration-plan.md` and is not wired.
- Hosted setup (Supabase migrations, admin roles, Stripe Prices, webhooks)
  is Mason-only. Follow `docs/setup-phase-1-portal.md`.
