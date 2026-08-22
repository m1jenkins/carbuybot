// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const baseMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260822071928_phase_1_portal.sql",
  ),
  "utf8",
);
const fulfillmentMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260822073726_stripe_fulfillment.sql",
  ),
  "utf8",
);
const intakeMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_conversational_intake.sql"));
const intakeMigration = intakeMigrationName
  ? readFileSync(
      join(process.cwd(), "supabase/migrations", intakeMigrationName),
      "utf8",
    )
  : "";
const intakeHardeningMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_harden_conversational_intake.sql"));
const intakeHardeningMigration = intakeHardeningMigrationName
  ? readFileSync(
      join(process.cwd(), "supabase/migrations", intakeHardeningMigrationName),
      "utf8",
    )
  : "";
const briefRevisionsMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_brief_revisions.sql"));
const briefRevisionsMigration = briefRevisionsMigrationName
  ? readFileSync(
      join(process.cwd(), "supabase/migrations", briefRevisionsMigrationName),
      "utf8",
    )
  : "";
const briefRevisionConsistencyMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_harden_brief_revision_consistency.sql"));
const briefRevisionConsistencyMigration = briefRevisionConsistencyMigrationName
  ? readFileSync(
      join(
        process.cwd(),
        "supabase/migrations",
        briefRevisionConsistencyMigrationName,
      ),
      "utf8",
    )
  : "";
const finalReviewMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_final_review_fixes.sql"));
const finalReviewMigration = finalReviewMigrationName
  ? readFileSync(
      join(process.cwd(), "supabase/migrations", finalReviewMigrationName),
      "utf8",
    )
  : "";
const checkoutReservationHardeningMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_harden_checkout_reservations.sql"));
const checkoutReservationHardeningMigration =
  checkoutReservationHardeningMigrationName
    ? readFileSync(
        join(
          process.cwd(),
          "supabase/migrations",
          checkoutReservationHardeningMigrationName,
        ),
        "utf8",
      )
    : "";

const engagementId = "a6204b70-c308-40e8-b87f-30843d48cb79";
const missingEngagementId = "83aca8da-9a4d-4b26-9414-7f444c39fc3d";
const userId = "f33054d1-ca4f-4ea5-b7ed-379efe27f46f";
const otherUserId = "4ddf748c-afd8-4e52-b500-6ba3b091d2ed";

type FulfillmentInput = {
  amountCents?: number | null;
  checkoutSessionId?: string | null;
  currency?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  engagementId?: string | null;
  eventId: string;
  eventType?: string;
  fulfill?: boolean;
  paymentIntentId?: string | null;
  priceId?: string | null;
};

async function insertPendingEngagement(db: PGlite, id = engagementId) {
  await db.query(
    `
      insert into public.engagements (
        id,
        customer_email,
        price_id,
        amount_cents,
        currency,
        payment_status,
        workflow_status
      )
      values ($1, 'buyer@example.com', 'price_intro_test', 34900, 'usd', 'pending', 'awaiting_brief')
    `,
    [id],
  );
}

async function callFulfillment(db: PGlite, input: FulfillmentInput) {
  const result = await db.query<{ processed: boolean }>(
    `
      select public.fulfill_stripe_event(
        $1::text,
        $2::text,
        $3::boolean,
        $4::uuid,
        $5::text,
        $6::text,
        $7::text,
        $8::text,
        $9::bigint,
        $10::text,
        $11::text
      ) as processed
    `,
    [
      input.eventId,
      input.eventType ?? "checkout.session.completed",
      input.fulfill ?? true,
      input.engagementId ?? engagementId,
      input.customerEmail ?? "buyer@example.com",
      input.checkoutSessionId ?? "cs_test_checkout",
      input.customerId ?? "cus_test_buyer",
      input.paymentIntentId ?? "pi_test_payment",
      input.amountCents ?? 34_900,
      input.currency ?? "usd",
      input.priceId ?? "price_intro_test",
    ],
  );

  return result.rows[0]?.processed;
}

async function reserveCheckout(
  db: PGlite,
  customerEmail: string,
) {
  const result = await db.query<{
    amount_cents: number;
    currency: string;
    id: string;
    intro_slot: number | null;
    price_id: string;
  }>(
    `
      select *
      from public.reserve_checkout_engagement(
        $1::text,
        'price_intro_test'::text,
        'price_standard_test'::text
      )
    `,
    [customerEmail],
  );
  return result.rows[0]!;
}

async function attachCheckout(
  db: PGlite,
  reservationId: string,
  checkoutSessionId = "cs_test_attached",
) {
  const result = await db.query<{ attached: boolean }>(
    `
      select public.attach_checkout_session(
        $1::uuid,
        $2::text
      ) as attached
    `,
    [reservationId, checkoutSessionId],
  );
  return result.rows[0]?.attached;
}

async function failCheckoutReservation(db: PGlite, reservationId: string) {
  const result = await db.query<{ failed: boolean }>(
    `
      select public.fail_checkout_reservation(
        $1::uuid
      ) as failed
    `,
    [reservationId],
  );
  return result.rows[0]?.failed;
}

async function expireCheckout(
  db: PGlite,
  input: {
    checkoutSessionId?: string;
    engagementId: string;
    eventId: string;
    priceId?: string;
  },
) {
  const result = await db.query<{ processed: boolean }>(
    `
      select public.expire_stripe_checkout(
        $1::text,
        $2::uuid,
        $3::text,
        $4::text
      ) as processed
    `,
    [
      input.eventId,
      input.engagementId,
      input.checkoutSessionId ?? "cs_test_expired",
      input.priceId ?? "price_intro_test",
    ],
  );
  return result.rows[0]?.processed;
}

async function refundPayment(
  db: PGlite,
  eventId: string,
  paymentIntentId = "pi_test_payment",
) {
  const result = await db.query<{ processed: boolean }>(
    `
      select public.refund_stripe_payment(
        $1::text,
        $2::text
      ) as processed
    `,
    [eventId, paymentIntentId],
  );
  return result.rows[0]?.processed;
}

async function claimEngagements(
  db: PGlite,
  ownerId: string,
  email = "buyer@example.com",
) {
  const result = await db.query<{ claimed: number }>(
    `
      select public.claim_paid_engagements(
        $1::uuid,
        $2::text
      ) as claimed
    `,
    [ownerId, email],
  );
  return result.rows[0]?.claimed;
}

async function asRole<T>(
  db: PGlite,
  role: "service_role" | "authenticated",
  operation: () => Promise<T>,
) {
  await db.exec(`set role ${role}`);
  try {
    return await operation();
  } finally {
    await db.exec("reset role");
  }
}

async function asAuthenticatedUser<T>(
  db: PGlite,
  authenticatedUserId: string,
  operation: () => Promise<T>,
) {
  await db.query(
    "select pg_catalog.set_config('request.jwt.claim.sub', $1, false)",
    [authenticatedUserId],
  );
  try {
    return await asRole(db, "authenticated", operation);
  } finally {
    await db.query(
      "select pg_catalog.set_config('request.jwt.claim.sub', '', false)",
    );
  }
}

async function insertClaimedPaidEngagement(db: PGlite) {
  await db.query("insert into auth.users (id) values ($1), ($2)", [
    userId,
    otherUserId,
  ]);
  await db.query(
    `
      insert into public.profiles (id, email)
      values
        ($1, 'buyer@example.com'),
        ($2, 'other@example.com')
    `,
    [userId, otherUserId],
  );
  await db.query(
    `
      insert into public.engagements (
        id,
        user_id,
        customer_email,
        price_id,
        amount_cents,
        currency,
        payment_status,
        workflow_status
      )
      values (
        $2,
        $1,
        'buyer@example.com',
        'price_intro_test',
        34900,
        'usd',
        'paid',
        'awaiting_brief'
      )
    `,
    [userId, engagementId],
  );
}

const completeDraftAnswers = {
  budgetCents: 6_000_000,
  city: "Austin",
  colors: ["Black"],
  condition: "either",
  consent: true,
  dealBreakers: [],
  financingPreference: "undecided",
  hasTradeIn: false,
  make: "Genesis",
  model: "GV80",
  notes: null,
  options: ["Advanced package"],
  postalCode: "78701",
  searchRadiusMiles: 100,
  state: "TX",
  timeline: "within_30_days",
  tradeInDetails: null,
  trim: null,
  yearMax: 2026,
  yearMin: 2024,
};

async function finalizeBrief(
  db: PGlite,
  ownerId = userId,
) {
  const result = await db.query<{ finalized: boolean }>(
    `
      select public.finalize_vehicle_brief(
        $1::uuid,
        $2::uuid
      ) as finalized
    `,
    [engagementId, ownerId],
  );

  return result.rows[0]?.finalized;
}

async function saveBriefAnswer(
  db: PGlite,
  questionId: string,
  value: unknown,
  currentQuestionId: string | null,
) {
  const result = await db.query<{ answers: Record<string, unknown> }>(
    `
      select public.save_brief_answer(
        $1::uuid,
        $2::text,
        $3::jsonb,
        $4::text
      ) as answers
    `,
    [
      engagementId,
      questionId,
      JSON.stringify(value),
      currentQuestionId,
    ],
  );
  return result.rows[0]?.answers;
}

async function insertDraft(
  db: PGlite,
  answers: Record<string, unknown>,
  currentQuestionId: string | null = null,
) {
  return asRole(db, "service_role", () =>
    db.query(
      `
        insert into public.brief_drafts (
          engagement_id,
          answers,
          current_question_id
        )
        values ($1, $2::jsonb, $3)
      `,
      [engagementId, JSON.stringify(answers), currentQuestionId],
    ),
  );
}

async function insertVehicleBriefDirectly(db: PGlite) {
  return db.query(
    `
      insert into public.vehicle_briefs (
        engagement_id,
        condition,
        make,
        model,
        colors,
        options,
        deal_breakers,
        budget_cents,
        city,
        state,
        postal_code,
        search_radius_miles,
        timeline,
        has_trade_in,
        financing_preference,
        consent
      )
      values (
        $1,
        'either',
        'Genesis',
        'GV80',
        '{"Black"}',
        '{}',
        '{}',
        6000000,
        'Austin',
        'TX',
        '78701',
        100,
        'within_30_days',
        false,
        'undecided',
        true
      )
    `,
    [engagementId],
  );
}

async function bootstrapThroughIntakeHardening(db: PGlite) {
  await db.exec(`
    create schema auth;
    create table auth.users (
      id uuid primary key
    );
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(
        pg_catalog.current_setting('request.jwt.claim.sub', true),
        ''
      )::uuid
    $$;

    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    grant usage on schema auth to authenticated, service_role;
    grant execute on function auth.uid() to authenticated, service_role;
  `);
  await db.exec(baseMigration);
  await db.exec(fulfillmentMigration);
  await db.exec(intakeMigration);
  await db.exec(intakeHardeningMigration);
}

describe("Stripe fulfillment migration runtime", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await bootstrapThroughIntakeHardening(db);
    await db.exec(briefRevisionsMigration);
    await db.exec(briefRevisionConsistencyMigration);
    await db.exec(finalReviewMigration);
    await db.exec(checkoutReservationHardeningMigration);
  });

  afterEach(async () => {
    await db.close();
  });

  it("fulfills a matching pending engagement as service_role", async () => {
    await insertPendingEngagement(db);

    await expect(
      asRole(db, "service_role", () =>
        callFulfillment(db, { eventId: "evt_test_success" }),
      ),
    ).resolves.toBe(true);

    const engagement = await db.query<{
      amount_cents: number;
      customer_email: string;
      payment_status: string;
      stripe_checkout_session_id: string;
      workflow_status: string;
    }>(
      `
        select
          amount_cents,
          customer_email,
          payment_status,
          stripe_checkout_session_id,
          workflow_status
        from public.engagements
        where id = $1
      `,
      [engagementId],
    );
    expect(engagement.rows[0]).toMatchObject({
      amount_cents: 34_900,
      customer_email: "buyer@example.com",
      payment_status: "paid",
      stripe_checkout_session_id: "cs_test_checkout",
      workflow_status: "awaiting_brief",
    });
    const events = await db.query<{ count: number }>(
      "select count(*)::int as count from public.stripe_events",
    );
    expect(events.rows[0]?.count).toBe(1);
  });

  it("links fulfillment to an exact pre-existing verified-email profile", async () => {
    await db.query("insert into auth.users (id) values ($1)", [userId]);
    await db.query(
      "insert into public.profiles (id, email) values ($1, 'buyer@example.com')",
      [userId],
    );
    await insertPendingEngagement(db);

    await asRole(db, "service_role", () =>
      callFulfillment(db, { eventId: "evt_test_profile_link" }),
    );

    const engagement = await db.query<{ user_id: string | null }>(
      "select user_id from public.engagements where id = $1",
      [engagementId],
    );
    expect(engagement.rows[0]?.user_id).toBe(userId);
  });

  it("rolls back amount or currency mismatches and permits a corrected retry", async () => {
    await insertPendingEngagement(db);

    await expect(
      asRole(db, "service_role", () =>
        callFulfillment(db, {
          amountCents: 39_900,
          eventId: "evt_test_amount_mismatch",
        }),
      ),
    ).rejects.toThrow(/matching pending engagement|amount|currency/i);

    const rejected = await db.query<{
      amount_cents: number;
      currency: string;
      event_count: number;
      payment_status: string;
    }>(
      `
        select
          amount_cents,
          currency,
          payment_status,
          (
            select count(*)::int
            from public.stripe_events
            where event_id = 'evt_test_amount_mismatch'
          ) as event_count
        from public.engagements
        where id = $1
      `,
      [engagementId],
    );
    expect(rejected.rows[0]).toEqual({
      amount_cents: 34_900,
      currency: "usd",
      event_count: 0,
      payment_status: "pending",
    });

    await expect(
      asRole(db, "service_role", () =>
        callFulfillment(db, {
          eventId: "evt_test_amount_mismatch",
        }),
      ),
    ).resolves.toBe(true);
    const fulfilled = await db.query<{
      amount_cents: number;
      currency: string;
      payment_status: string;
    }>(
      `
        select amount_cents, currency, payment_status
        from public.engagements
        where id = $1
      `,
      [engagementId],
    );
    expect(fulfilled.rows[0]).toEqual({
      amount_cents: 34_900,
      currency: "usd",
      payment_status: "paid",
    });
  });

  it("atomically reserves no more than 100 introductory slots", async () => {
    const reservations = await asRole(db, "service_role", () =>
      Promise.all(
        Array.from({ length: 101 }, (_, index) =>
          reserveCheckout(db, `buyer${index}@example.com`),
        ),
      ),
    );

    expect(
      reservations.filter((reservation) => reservation.intro_slot !== null),
    ).toHaveLength(100);
    expect(new Set(reservations.map((row) => row.intro_slot).filter(Boolean)).size)
      .toBe(100);
    expect(reservations.at(-1)).toMatchObject({
      amount_cents: 39_900,
      currency: "usd",
      intro_slot: null,
      price_id: "price_standard_test",
    });
  });

  it("reuses one recent pending reservation for same-email retries", async () => {
    const first = await asRole(db, "service_role", () =>
      reserveCheckout(db, "repeat@example.com"),
    );
    const retry = await asRole(db, "service_role", () =>
      reserveCheckout(db, "repeat@example.com"),
    );

    expect(retry).toEqual(first);
    const state = await db.query<{
      count: number;
      intro_slot: number;
      payment_status: string;
    }>(
      `
        select
          count(*)::int as count,
          min(intro_slot)::int as intro_slot,
          min(payment_status::text) as payment_status
        from public.engagements
        where customer_email = 'repeat@example.com'
      `,
    );
    expect(state.rows[0]).toEqual({
      count: 1,
      intro_slot: 1,
      payment_status: "pending",
    });
  });

  it("attaches the recovered Session idempotently without changing its reservation", async () => {
    const reservation = await asRole(db, "service_role", () =>
      reserveCheckout(db, "attach@example.com"),
    );

    await expect(
      asRole(db, "service_role", () =>
        attachCheckout(db, reservation.id, "cs_test_recovered"),
      ),
    ).resolves.toBe(true);
    await expect(
      asRole(db, "service_role", () =>
        attachCheckout(db, reservation.id, "cs_test_recovered"),
      ),
    ).resolves.toBe(true);
    await expect(
      asRole(db, "service_role", () =>
        attachCheckout(db, reservation.id, "cs_test_different"),
      ),
    ).rejects.toThrow(/matching unattached pending reservation/i);

    const retry = await asRole(db, "service_role", () =>
      reserveCheckout(db, "attach@example.com"),
    );
    expect(retry).toEqual(reservation);
    const state = await db.query<{
      intro_slot: number;
      payment_status: string;
      stripe_checkout_session_id: string;
    }>(
      `
        select intro_slot, payment_status, stripe_checkout_session_id
        from public.engagements
        where id = $1
      `,
      [reservation.id],
    );
    expect(state.rows[0]).toEqual({
      intro_slot: 1,
      payment_status: "pending",
      stripe_checkout_session_id: "cs_test_recovered",
    });
  });

  it("releases only a definitively failed unattached reservation", async () => {
    const failedReservation = await asRole(db, "service_role", () =>
      reserveCheckout(db, "failed@example.com"),
    );
    await expect(
      asRole(db, "service_role", () =>
        failCheckoutReservation(db, failedReservation.id),
      ),
    ).resolves.toBe(true);
    await expect(
      asRole(db, "service_role", () =>
        failCheckoutReservation(db, failedReservation.id),
      ),
    ).resolves.toBe(false);

    const replacement = await asRole(db, "service_role", () =>
      reserveCheckout(db, "replacement@example.com"),
    );
    expect(replacement.intro_slot).toBe(1);

    const attachedReservation = await asRole(db, "service_role", () =>
      reserveCheckout(db, "ambiguous@example.com"),
    );
    await asRole(db, "service_role", () =>
      attachCheckout(db, attachedReservation.id, "cs_test_ambiguous"),
    );
    await expect(
      asRole(db, "service_role", () =>
        failCheckoutReservation(db, attachedReservation.id),
      ),
    ).resolves.toBe(false);
    const attachedState = await db.query<{
      intro_slot: number;
      payment_status: string;
    }>(
      "select intro_slot, payment_status from public.engagements where id = $1",
      [attachedReservation.id],
    );
    expect(attachedState.rows[0]).toEqual({
      intro_slot: 2,
      payment_status: "pending",
    });
  });

  it("releases expired pending slots while paid and refunded slots remain durable", async () => {
    const first = await asRole(db, "service_role", () =>
      reserveCheckout(db, "first@example.com"),
    );
    const second = await asRole(db, "service_role", () =>
      reserveCheckout(db, "second@example.com"),
    );
    expect(first.intro_slot).toBe(1);
    expect(second.intro_slot).toBe(2);

    await asRole(db, "service_role", () =>
      expireCheckout(db, {
        engagementId: first.id,
        eventId: "evt_test_expired_slot",
      }),
    );
    const replacement = await asRole(db, "service_role", () =>
      reserveCheckout(db, "replacement@example.com"),
    );
    expect(replacement.intro_slot).toBe(1);

    await asRole(db, "service_role", () =>
      callFulfillment(db, {
        customerEmail: "second@example.com",
        engagementId: second.id,
        eventId: "evt_test_second_paid",
      }),
    );
    await asRole(db, "service_role", () =>
      refundPayment(db, "evt_test_second_refunded"),
    );
    const retained = await db.query<{
      intro_slot: number;
      payment_status: string;
    }>(
      "select intro_slot, payment_status from public.engagements where id = $1",
      [second.id],
    );
    expect(retained.rows[0]).toEqual({
      intro_slot: 2,
      payment_status: "refunded",
    });
  });

  it("returns duplicate without changing the fulfilled engagement", async () => {
    await insertPendingEngagement(db);
    await asRole(db, "service_role", () =>
      callFulfillment(db, { eventId: "evt_test_duplicate" }),
    );

    await expect(
      asRole(db, "service_role", () =>
        callFulfillment(db, {
          amountCents: 39_900,
          customerEmail: "changed@example.com",
          eventId: "evt_test_duplicate",
        }),
      ),
    ).resolves.toBe(false);

    const state = await db.query<{
      amount_cents: number;
      customer_email: string;
      event_count: number;
    }>(
      `
        select
          e.amount_cents,
          e.customer_email,
          (select count(*)::int from public.stripe_events) as event_count
        from public.engagements e
        where e.id = $1
      `,
      [engagementId],
    );
    expect(state.rows[0]).toMatchObject({
      amount_cents: 34_900,
      customer_email: "buyer@example.com",
      event_count: 1,
    });
  });

  it("rolls back a failed event insert so the same event can retry", async () => {
    const retryInput = {
      engagementId: missingEngagementId,
      eventId: "evt_test_retry",
    };

    await expect(
      asRole(db, "service_role", () => callFulfillment(db, retryInput)),
    ).rejects.toThrow(/matching pending engagement/i);
    const failedEvents = await db.query<{ count: number }>(
      `
        select count(*)::int as count
        from public.stripe_events
        where event_id = 'evt_test_retry'
      `,
    );
    expect(failedEvents.rows[0]?.count).toBe(0);

    await insertPendingEngagement(db, missingEngagementId);
    await expect(
      asRole(db, "service_role", () => callFulfillment(db, retryInput)),
    ).resolves.toBe(true);

    const retriedState = await db.query<{
      event_count: number;
      payment_status: string;
    }>(
      `
        select
          e.payment_status,
          (
            select count(*)::int
            from public.stripe_events
            where event_id = 'evt_test_retry'
          ) as event_count
        from public.engagements e
        where e.id = $1
      `,
      [missingEngagementId],
    );
    expect(retriedState.rows[0]).toMatchObject({
      event_count: 1,
      payment_status: "paid",
    });
  });

  it("denies authenticated execution of the fulfillment RPC", async () => {
    await expect(
      asRole(db, "authenticated", () =>
        callFulfillment(db, {
          eventId: "evt_test_forbidden",
          fulfill: false,
        }),
      ),
    ).rejects.toThrow(/permission denied/i);

    const events = await db.query<{ count: number }>(
      "select count(*)::int as count from public.stripe_events",
    );
    expect(events.rows[0]?.count).toBe(0);
  });

  it("denies authenticated reservation attachment and failure release", async () => {
    const reservation = await asRole(db, "service_role", () =>
      reserveCheckout(db, "restricted@example.com"),
    );

    await expect(
      asRole(db, "authenticated", () =>
        attachCheckout(db, reservation.id, "cs_test_forbidden"),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      asRole(db, "authenticated", () =>
        failCheckoutReservation(db, reservation.id),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("claims exact-email refunded engagements before or after the refund", async () => {
    await db.query("insert into auth.users (id) values ($1)", [userId]);
    await insertPendingEngagement(db);
    await asRole(db, "service_role", () =>
      callFulfillment(db, { eventId: "evt_test_paid_before_refund" }),
    );
    await asRole(db, "service_role", () =>
      refundPayment(db, "evt_test_refund_before_claim"),
    );

    await expect(
      asRole(db, "service_role", () => claimEngagements(db, userId)),
    ).resolves.toBe(1);

    const secondId = "83aca8da-9a4d-4b26-9414-7f444c39fc3d";
    await insertPendingEngagement(db, secondId);
    await asRole(db, "service_role", () =>
      callFulfillment(db, {
        checkoutSessionId: "cs_test_second_claim",
        engagementId: secondId,
        eventId: "evt_test_second_paid_before_claim",
        paymentIntentId: "pi_test_second_claim",
      }),
    );
    await expect(
      asRole(db, "service_role", () => claimEngagements(db, userId)),
    ).resolves.toBe(0);
    await asRole(db, "service_role", () =>
      refundPayment(
        db,
        "evt_test_refund_after_claim",
        "pi_test_second_claim",
      ),
    );

    const reconciled = await db.query<{
      payment_status: string;
      title: string;
      update_count: number;
      user_id: string;
    }>(
      `
        select
          engagements.payment_status,
          engagements.user_id,
          updates.title,
          (
            select count(*)::int
            from public.status_updates
            where engagement_id = engagements.id
              and title = 'Payment refunded'
          ) as update_count
        from public.engagements
        join public.status_updates as updates
          on updates.engagement_id = engagements.id
          and updates.title = 'Payment refunded'
        where engagements.id = $1
      `,
      [secondId],
    );
    expect(reconciled.rows[0]).toEqual({
      payment_status: "refunded",
      title: "Payment refunded",
      update_count: 1,
      user_id: userId,
    });

    await expect(
      asRole(db, "service_role", () =>
        refundPayment(
          db,
          "evt_test_refund_after_claim_duplicate_delivery",
          "pi_test_second_claim",
        ),
      ),
    ).resolves.toBe(true);
    const duplicateAudit = await db.query<{ count: number }>(
      `
        select count(*)::int as count
        from public.status_updates
        where engagement_id = $1
          and title = 'Payment refunded'
      `,
      [secondId],
    );
    expect(duplicateAudit.rows[0]?.count).toBe(1);
  });

  it("lets only the paid owner save one answer through the authenticated RPC", async () => {
    await insertClaimedPaidEngagement(db);

    await expect(
      asAuthenticatedUser(db, userId, () =>
        saveBriefAnswer(db, "condition", "new", "make"),
      ),
    ).resolves.toEqual({ condition: "new" });
    await expect(
      asAuthenticatedUser(db, otherUserId, () =>
        saveBriefAnswer(db, "condition", "used", "make"),
      ),
    ).rejects.toThrow(/owned paid engagement/i);

    const ownerDraft = await asAuthenticatedUser(db, userId, () =>
      db.query<{
        answers: { condition: string };
        current_question_id: string;
      }>(
        `
          select answers, current_question_id
          from public.brief_drafts
          where engagement_id = $1
        `,
        [engagementId],
      ),
    );
    expect(ownerDraft.rows[0]).toEqual({
      answers: { condition: "new" },
      current_question_id: "make",
    });
  });

  it("atomically merges rapid answers without losing either key", async () => {
    await insertClaimedPaidEngagement(db);

    await asAuthenticatedUser(db, userId, () =>
      Promise.all([
        saveBriefAnswer(db, "make", "Genesis", "model"),
        saveBriefAnswer(db, "model", "GV80", "yearMin"),
      ]),
    );

    const draft = await db.query<{
      answers: { make: string; model: string };
    }>(
      "select answers from public.brief_drafts where engagement_id = $1",
      [engagementId],
    );
    expect(draft.rows[0]?.answers).toMatchObject({
      make: "Genesis",
      model: "GV80",
    });
  });

  it("keeps the furthest cursor when saves finish in reverse question order", async () => {
    await insertClaimedPaidEngagement(db);
    await asAuthenticatedUser(db, userId, () =>
      saveBriefAnswer(db, "model", "GV80", "yearMin"),
    );
    await asAuthenticatedUser(db, userId, () =>
      saveBriefAnswer(db, "make", "Genesis", "model"),
    );

    const draft = await db.query<{
      answers: { make: string; model: string };
      current_question_id: string;
      progress_index: number;
    }>(
      `
        select answers, current_question_id, progress_index
        from public.brief_drafts
        where engagement_id = $1
      `,
      [engagementId],
    );
    expect(draft.rows[0]).toEqual({
      answers: { make: "Genesis", model: "GV80" },
      current_question_id: "yearMin",
      progress_index: 2,
    });
  });

  it("merges a late Back edit without reversing the finalized consent cursor", async () => {
    await insertClaimedPaidEngagement(db);
    const preConsentAnswers: Record<string, unknown> = {
      ...completeDraftAnswers,
    };
    delete preConsentAnswers.consent;
    await insertDraft(db, preConsentAnswers, "consent");
    await asAuthenticatedUser(db, userId, () =>
      saveBriefAnswer(db, "consent", true, null),
    );
    await asAuthenticatedUser(db, userId, () =>
      saveBriefAnswer(db, "make", "Toyota", "model"),
    );

    const draft = await db.query<{
      current_question_id: string | null;
      make: string;
      progress_index: number;
    }>(
      `
        select
          current_question_id,
          answers ->> 'make' as make,
          progress_index
        from public.brief_drafts
        where engagement_id = $1
      `,
      [engagementId],
    );
    expect(draft.rows[0]).toEqual({
      current_question_id: null,
      make: "Toyota",
      progress_index: 19,
    });
  });

  it("rejects an inverted year range without changing or advancing the draft", async () => {
    await insertClaimedPaidEngagement(db);
    await asAuthenticatedUser(db, userId, () =>
      saveBriefAnswer(db, "yearMax", 2024, "yearMin"),
    );

    await expect(
      asAuthenticatedUser(db, userId, () =>
        saveBriefAnswer(db, "yearMin", 2025, "yearMax"),
      ),
    ).rejects.toThrow(/minimum year cannot be later than maximum year/i);

    const draft = await db.query<{
      answers: Record<string, unknown>;
      current_question_id: string;
    }>(
      `
        select answers, current_question_id
        from public.brief_drafts
        where engagement_id = $1
      `,
      [engagementId],
    );
    expect(draft.rows[0]).toEqual({
      answers: { yearMax: 2024 },
      current_question_id: "yearMin",
    });
  });

  it("denies authenticated vehicle-brief inserts before finalization and updates after it", async () => {
    await insertClaimedPaidEngagement(db);

    await expect(
      asAuthenticatedUser(db, userId, () => insertVehicleBriefDirectly(db)),
    ).rejects.toThrow(/permission denied/i);

    await insertDraft(db, completeDraftAnswers);
    await asRole(db, "service_role", () => finalizeBrief(db));

    await expect(
      asAuthenticatedUser(db, userId, () =>
        db.query(
          `
            update public.vehicle_briefs
            set make = 'Tampered'
            where engagement_id = $1
          `,
          [engagementId],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);

    const visibleBrief = await asAuthenticatedUser(db, userId, () =>
      db.query<{ make: string }>(
        "select make from public.vehicle_briefs where engagement_id = $1",
        [engagementId],
      ),
    );
    expect(visibleBrief.rows[0]?.make).toBe("Genesis");
  });

  it("finalizes the latest locked draft, workflow, first update, and retained revision draft atomically", async () => {
    await insertClaimedPaidEngagement(db);
    await insertDraft(db, completeDraftAnswers);
    await asAuthenticatedUser(db, userId, () =>
      saveBriefAnswer(db, "make", "Toyota", null),
    );

    await expect(
      asRole(db, "service_role", () => finalizeBrief(db)),
    ).resolves.toBe(true);

    const state = await db.query<{
      budget_cents: number;
      current_question_id: string;
      draft_count: number;
      make: string;
      onboarding_completed_at: Date | null;
      progress_index: number;
      status: string;
      title: string;
      update_count: number;
      workflow_status: string;
    }>(
      `
        select
          e.workflow_status,
          e.onboarding_completed_at,
          b.make,
          b.budget_cents,
          d.current_question_id,
          d.progress_index,
          u.status,
          u.title,
          (select count(*)::int from public.status_updates) as update_count,
          (select count(*)::int from public.brief_drafts) as draft_count
        from public.engagements e
        join public.vehicle_briefs b on b.engagement_id = e.id
        join public.brief_drafts d on d.engagement_id = e.id
        join public.status_updates u on u.engagement_id = e.id
        where e.id = $1
      `,
      [engagementId],
    );
    expect(state.rows[0]).toMatchObject({
      budget_cents: 6_000_000,
      current_question_id: "condition",
      draft_count: 1,
      make: "Toyota",
      progress_index: -1,
      status: "brief_submitted",
      title: "Brief submitted",
      update_count: 1,
      workflow_status: "brief_submitted",
    });
    expect(state.rows[0]?.onboarding_completed_at).not.toBeNull();
  });

  it("resets and reloads revision progress after every changed finalization", async () => {
    await insertClaimedPaidEngagement(db);
    await insertDraft(db, completeDraftAnswers);
    await asRole(db, "service_role", () => finalizeBrief(db));

    await asAuthenticatedUser(db, userId, () =>
      saveBriefAnswer(db, "condition", "new", "make"),
    );
    let cursor = await db.query<{
      current_question_id: string;
      progress_index: number;
    }>(
      `
        select current_question_id, progress_index
        from public.brief_drafts
        where engagement_id = $1
      `,
      [engagementId],
    );
    expect(cursor.rows[0]).toEqual({
      current_question_id: "make",
      progress_index: 0,
    });

    await asAuthenticatedUser(db, userId, () =>
      saveBriefAnswer(db, "consent", true, null),
    );
    await asRole(db, "service_role", () => finalizeBrief(db));
    cursor = await db.query<{
      current_question_id: string;
      progress_index: number;
    }>(
      `
        select current_question_id, progress_index
        from public.brief_drafts
        where engagement_id = $1
      `,
      [engagementId],
    );
    expect(cursor.rows[0]).toEqual({
      current_question_id: "condition",
      progress_index: -1,
    });

    await asAuthenticatedUser(db, userId, () =>
      saveBriefAnswer(db, "condition", "used", "make"),
    );
    cursor = await db.query<{
      current_question_id: string;
      progress_index: number;
    }>(
      `
        select current_question_id, progress_index
        from public.brief_drafts
        where engagement_id = $1
      `,
      [engagementId],
    );
    expect(cursor.rows[0]).toEqual({
      current_question_id: "make",
      progress_index: 0,
    });
  });

  it("emits one submitted event for concurrent and retried unchanged finalization", async () => {
    await insertClaimedPaidEngagement(db);
    await insertDraft(db, completeDraftAnswers);

    await asRole(db, "service_role", () =>
      Promise.all([finalizeBrief(db), finalizeBrief(db)]),
    );
    await asRole(db, "service_role", () => finalizeBrief(db));

    const state = await db.query<{
      baseline_matches: boolean;
      submitted_count: number;
      updated_count: number;
    }>(
      `
        select
          d.baseline_answers = d.answers as baseline_matches,
          (
            select count(*)::int
            from public.status_updates
            where title = 'Brief submitted'
          ) as submitted_count,
          (
            select count(*)::int
            from public.status_updates
            where title = 'Brief updated'
          ) as updated_count
        from public.brief_drafts d
        where d.engagement_id = $1
      `,
      [engagementId],
    );
    expect(state.rows[0]).toEqual({
      baseline_matches: true,
      submitted_count: 1,
      updated_count: 0,
    });
  });

  it("rolls back every finalization write when the locked draft is invalid", async () => {
    await insertClaimedPaidEngagement(db);
    await insertDraft(db, { ...completeDraftAnswers, postalCode: "12" });

    await expect(
      asRole(db, "service_role", () => finalizeBrief(db)),
    ).rejects.toThrow(/postal_code|vehicle_briefs_postal_code_check/i);

    const state = await db.query<{
      brief_count: number;
      draft_count: number;
      update_count: number;
      workflow_status: string;
    }>(
      `
        select
          e.workflow_status,
          (select count(*)::int from public.vehicle_briefs) as brief_count,
          (select count(*)::int from public.status_updates) as update_count,
          (select count(*)::int from public.brief_drafts) as draft_count
        from public.engagements e
        where e.id = $1
      `,
      [engagementId],
    );
    expect(state.rows[0]).toEqual({
      brief_count: 0,
      draft_count: 1,
      update_count: 0,
      workflow_status: "awaiting_brief",
    });
  });

  it("rejects a mismatched owner and authenticated finalization execution", async () => {
    await insertClaimedPaidEngagement(db);
    await insertDraft(db, completeDraftAnswers);

    await expect(
      asRole(db, "service_role", () => finalizeBrief(db, otherUserId)),
    ).rejects.toThrow(/owned paid engagement/i);
    await expect(
      asAuthenticatedUser(db, userId, () => finalizeBrief(db)),
    ).rejects.toThrow(/permission denied/i);

    const state = await db.query<{
      brief_count: number;
      draft_count: number;
      workflow_status: string;
    }>(
      `
        select
          e.workflow_status,
          (select count(*)::int from public.vehicle_briefs) as brief_count,
          (select count(*)::int from public.brief_drafts) as draft_count
        from public.engagements e
        where e.id = $1
      `,
      [engagementId],
    );
    expect(state.rows[0]).toEqual({
      brief_count: 0,
      draft_count: 1,
      workflow_status: "awaiting_brief",
    });
  });

  it("lets the paid owner revise and re-finalize only while the brief remains submitted", async () => {
    await insertClaimedPaidEngagement(db);
    await insertDraft(db, completeDraftAnswers);
    await asRole(db, "service_role", () => finalizeBrief(db));

    await expect(
      asAuthenticatedUser(db, userId, () =>
        saveBriefAnswer(db, "make", "Toyota", null),
      ),
    ).resolves.toMatchObject({ make: "Toyota" });
    await expect(
      asAuthenticatedUser(db, otherUserId, () =>
        saveBriefAnswer(db, "make", "Tampered", null),
      ),
    ).rejects.toThrow(/owned paid engagement/i);
    await expect(
      asRole(db, "service_role", () => finalizeBrief(db)),
    ).resolves.toBe(true);

    const revised = await db.query<{
      baseline_matches: boolean;
      draft_count: number;
      make: string;
      submitted_count: number;
      updated_count: number;
      workflow_status: string;
    }>(
      `
        select
          e.workflow_status,
          b.make,
          d.baseline_answers = d.answers as baseline_matches,
          (select count(*)::int from public.brief_drafts) as draft_count,
          (
            select count(*)::int
            from public.status_updates
            where title = 'Brief submitted'
          ) as submitted_count,
          (
            select count(*)::int
            from public.status_updates
            where title = 'Brief updated'
          ) as updated_count
        from public.engagements e
        join public.vehicle_briefs b on b.engagement_id = e.id
        join public.brief_drafts d on d.engagement_id = e.id
        where e.id = $1
      `,
      [engagementId],
    );
    expect(revised.rows[0]).toEqual({
      baseline_matches: true,
      draft_count: 1,
      make: "Toyota",
      submitted_count: 1,
      updated_count: 1,
      workflow_status: "brief_submitted",
    });

    await asRole(db, "service_role", () =>
      db.query(
        `
          update public.engagements
          set workflow_status = 'in_review'
          where id = $1
        `,
        [engagementId],
      ),
    );
    await expect(
      asAuthenticatedUser(db, userId, () =>
        saveBriefAnswer(db, "make", "Blocked", null),
      ),
    ).rejects.toThrow(/owned paid engagement/i);
  });

  it("upgrades a pre-existing submitted brief into an editable draft with a baseline", async () => {
    const upgradeDb = new PGlite();
    try {
      await bootstrapThroughIntakeHardening(upgradeDb);
      await insertClaimedPaidEngagement(upgradeDb);
      await upgradeDb.query(
        `
          update public.engagements
          set workflow_status = 'brief_submitted',
              onboarding_completed_at = pg_catalog.now()
          where id = $1
        `,
        [engagementId],
      );
      await insertVehicleBriefDirectly(upgradeDb);

      await upgradeDb.exec(briefRevisionsMigration);
      await upgradeDb.exec(briefRevisionConsistencyMigration);
      await upgradeDb.exec(finalReviewMigration);

      const upgraded = await upgradeDb.query<{
        answers_match: boolean;
        baseline_make: string;
        current_question_id: string | null;
        draft_make: string;
        progress_index: number;
      }>(
        `
          select
            answers = baseline_answers as answers_match,
            answers ->> 'make' as draft_make,
            baseline_answers ->> 'make' as baseline_make,
            current_question_id,
            progress_index
          from public.brief_drafts
          where engagement_id = $1
        `,
        [engagementId],
      );
      expect(upgraded.rows[0]).toEqual({
        answers_match: true,
        baseline_make: "Genesis",
        current_question_id: "condition",
        draft_make: "Genesis",
        progress_index: -1,
      });
    } finally {
      await upgradeDb.close();
    }
  });

  it("lets an owner select only customer-visible status history", async () => {
    await insertClaimedPaidEngagement(db);
    await asRole(db, "service_role", () =>
      db.query(
        `
          insert into public.status_updates (
            engagement_id,
            status,
            title,
            note,
            customer_visible
          )
          values
            ($1, 'searching', 'Customer update', 'Visible note', true),
            ($1, 'searching', 'Internal update', 'Internal only', false)
        `,
        [engagementId],
      ),
    );

    const ownerUpdates = await asAuthenticatedUser(db, userId, () =>
      db.query<{ title: string }>(
        `
          select title
          from public.status_updates
          where engagement_id = $1
          order by created_at
        `,
        [engagementId],
      ),
    );
    const otherUpdates = await asAuthenticatedUser(db, otherUserId, () =>
      db.query<{ title: string }>(
        "select title from public.status_updates where engagement_id = $1",
        [engagementId],
      ),
    );

    expect(ownerUpdates.rows).toEqual([{ title: "Customer update" }]);
    expect(otherUpdates.rows).toEqual([]);
  });
});
