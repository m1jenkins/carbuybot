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

describe("Stripe fulfillment migration runtime", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
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
    await db.exec(briefRevisionsMigration);
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
      draft_count: number;
      make: string;
      onboarding_completed_at: Date | null;
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
          u.status,
          u.title,
          (select count(*)::int from public.status_updates) as update_count,
          (select count(*)::int from public.brief_drafts) as draft_count
        from public.engagements e
        join public.vehicle_briefs b on b.engagement_id = e.id
        join public.status_updates u on u.engagement_id = e.id
        where e.id = $1
      `,
      [engagementId],
    );
    expect(state.rows[0]).toMatchObject({
      budget_cents: 6_000_000,
      draft_count: 1,
      make: "Toyota",
      status: "brief_submitted",
      title: "Brief submitted",
      update_count: 1,
      workflow_status: "brief_submitted",
    });
    expect(state.rows[0]?.onboarding_completed_at).not.toBeNull();
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
        where e.id = $1
      `,
      [engagementId],
    );
    expect(revised.rows[0]).toEqual({
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
