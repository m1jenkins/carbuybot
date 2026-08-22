// @vitest-environment node

import { readFileSync } from "node:fs";
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

const engagementId = "a6204b70-c308-40e8-b87f-30843d48cb79";
const missingEngagementId = "83aca8da-9a4d-4b26-9414-7f444c39fc3d";

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
      as $$ select null::uuid $$;

      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      grant usage on schema auth to authenticated, service_role;
      grant execute on function auth.uid() to authenticated, service_role;
    `);
    await db.exec(baseMigration);
    await db.exec(fulfillmentMigration);
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
});
