// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const migrations = readdirSync(
  join(process.cwd(), "supabase/migrations"),
)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) =>
    readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8"),
  );

const adminId = "f33054d1-ca4f-4ea5-b7ed-379efe27f46f";
const nonAdminId = "4ddf748c-afd8-4e52-b500-6ba3b091d2ed";
const engagementId = "a6204b70-c308-40e8-b87f-30843d48cb79";

async function asRole<T>(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
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
  userId: string,
  operation: () => Promise<T>,
) {
  await db.query(
    "select pg_catalog.set_config('request.jwt.claim.sub', $1, false)",
    [userId],
  );
  try {
    return await asRole(db, "authenticated", operation);
  } finally {
    await db.query(
      "select pg_catalog.set_config('request.jwt.claim.sub', '', false)",
    );
  }
}

async function callStatusUpdate(
  db: PGlite,
  nextStatus: string,
  title = "Brief review started",
  note = "We are reviewing your vehicle brief before the search begins.",
) {
  const result = await db.query<{ updated: boolean }>(
    `
      select public.update_engagement_status(
        $1::uuid,
        $2::text,
        $3::text,
        $4::text
      ) as updated
    `,
    [engagementId, nextStatus, title, note],
  );
  return result.rows[0]?.updated;
}

async function readState(db: PGlite) {
  const result = await db.query<{
    author_id: string | null;
    customer_visible: boolean | null;
    note: string | null;
    status: string | null;
    title: string | null;
    update_count: number;
    updated_at: Date;
    workflow_status: string;
  }>(
    `
      select
        engagements.workflow_status,
        engagements.updated_at,
        updates.author_id,
        updates.customer_visible,
        updates.status,
        updates.title,
        updates.note,
        (
          select pg_catalog.count(*)::int
          from public.status_updates
          where engagement_id = engagements.id
        ) as update_count
      from public.engagements
      left join lateral (
        select *
        from public.status_updates
        where engagement_id = engagements.id
        order by created_at desc
        limit 1
      ) as updates on true
      where engagements.id = $1
    `,
    [engagementId],
  );
  return result.rows[0]!;
}

describe("admin workflow migration runtime", () => {
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
    for (const migration of migrations) {
      await db.exec(migration);
    }

    await db.query(
      "insert into auth.users (id) values ($1), ($2)",
      [adminId, nonAdminId],
    );
    await db.query(
      `
        insert into public.admin_users (user_id, role, active)
        values ($1, 'admin', true)
      `,
      [adminId],
    );
    await db.query(
      `
        insert into public.engagements (
          id,
          customer_email,
          price_id,
          amount_cents,
          currency,
          payment_status,
          workflow_status,
          created_at,
          updated_at
        )
        values (
          $1,
          'buyer@example.com',
          'price_intro_test',
          34900,
          'usd',
          'paid',
          'brief_submitted',
          '2026-08-20 12:00:00+00',
          '2026-08-20 12:00:00+00'
        )
      `,
      [engagementId],
    );
    await db.query(
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
          '{}',
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
  });

  afterEach(async () => {
    await db.close();
  });

  it("grants execution only to authenticated callers and still checks admin RLS", async () => {
    await expect(
      asRole(db, "anon", () => callStatusUpdate(db, "in_review")),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      asRole(db, "service_role", () => callStatusUpdate(db, "in_review")),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      asAuthenticatedUser(db, nonAdminId, () =>
        callStatusUpdate(db, "in_review"),
      ),
    ).rejects.toThrow(/admin access is required/i);

    const state = await readState(db);
    expect(state.workflow_status).toBe("brief_submitted");
    expect(state.update_count).toBe(0);
  });

  it("blocks direct writes even when an admin forges the old custom GUC", async () => {
    await expect(
      asAuthenticatedUser(db, adminId, async () => {
        await db.query(
          "select pg_catalog.set_config('app.admin_status_rpc_user', $1, false)",
          [adminId],
        );
        return db.query(
          `
            update public.engagements
            set workflow_status = 'in_review',
                updated_at = pg_catalog.now()
            where id = $1
          `,
          [engagementId],
        );
      }),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      asAuthenticatedUser(db, adminId, async () => {
        await db.query(
          "select pg_catalog.set_config('app.admin_status_rpc_user', $1, false)",
          [adminId],
        );
        return db.query(
          `
              insert into public.status_updates (
                engagement_id,
                author_id,
                status,
                title,
                note,
                customer_visible
              )
              values ($1, $2, 'in_review', 'Unpaired', 'Direct insert', true)
            `,
          [engagementId, adminId],
        );
      }),
    ).rejects.toThrow(/permission denied/i);

    const state = await readState(db);
    expect(state.workflow_status).toBe("brief_submitted");
    expect(state.update_count).toBe(0);
  });

  it("locks and applies one allowed transition with exactly one visible admin note", async () => {
    await expect(
      asAuthenticatedUser(db, adminId, () =>
        callStatusUpdate(db, "in_review"),
      ),
    ).resolves.toBe(true);

    const state = await readState(db);
    expect(state).toMatchObject({
      author_id: adminId,
      customer_visible: true,
      note: "We are reviewing your vehicle brief before the search begins.",
      status: "in_review",
      title: "Brief review started",
      update_count: 1,
      workflow_status: "in_review",
    });
    expect(state.updated_at.getTime()).toBeGreaterThan(
      new Date("2026-08-20T12:00:00.000Z").getTime(),
    );
  });

  it("rejects repeated and disallowed transitions without fake activity", async () => {
    await asAuthenticatedUser(db, adminId, () =>
      callStatusUpdate(db, "in_review"),
    );
    const afterFirst = await readState(db);

    await expect(
      asAuthenticatedUser(db, adminId, () =>
        callStatusUpdate(db, "in_review", "Repeated", "Repeated note"),
      ),
    ).rejects.toThrow(/transition is not allowed/i);
    await expect(
      asAuthenticatedUser(db, adminId, () =>
        callStatusUpdate(db, "offers_ready", "Skipped", "Skipped steps"),
      ),
    ).rejects.toThrow(/transition is not allowed/i);

    const afterRetries = await readState(db);
    expect(afterRetries.workflow_status).toBe("in_review");
    expect(afterRetries.update_count).toBe(1);
    expect(afterRetries.title).toBe("Brief review started");
    expect(afterRetries.updated_at).toEqual(afterFirst.updated_at);
  });

  it("rejects unpaid operational transitions without an audit row", async () => {
    await db.query(
      "update public.engagements set payment_status = 'refunded' where id = $1",
      [engagementId],
    );

    await expect(
      asAuthenticatedUser(db, adminId, () =>
        callStatusUpdate(db, "in_review"),
      ),
    ).rejects.toThrow(/paid engagement/i);

    const state = await readState(db);
    expect(state.workflow_status).toBe("brief_submitted");
    expect(state.update_count).toBe(0);
  });

  it("rejects operational transitions without a vehicle brief or audit row", async () => {
    await db.query("delete from public.vehicle_briefs where engagement_id = $1", [
      engagementId,
    ]);

    await expect(
      asAuthenticatedUser(db, adminId, () =>
        callStatusUpdate(db, "in_review"),
      ),
    ).rejects.toThrow(/vehicle brief/i);

    const state = await readState(db);
    expect(state.workflow_status).toBe("brief_submitted");
    expect(state.update_count).toBe(0);
  });

  it("reserves awaiting-brief submission for the customer finalization flow", async () => {
    await db.query(
      "update public.engagements set workflow_status = 'awaiting_brief' where id = $1",
      [engagementId],
    );

    await expect(
      asAuthenticatedUser(db, adminId, () =>
        callStatusUpdate(db, "brief_submitted"),
      ),
    ).rejects.toThrow(/transition is not allowed/i);

    const state = await readState(db);
    expect(state.workflow_status).toBe("awaiting_brief");
    expect(state.update_count).toBe(0);
  });

  it("rolls back the engagement update if inserting its audit note fails", async () => {
    await db.exec(`
      create or replace function private.reject_test_status_update()
      returns trigger
      language plpgsql
      security invoker
      set search_path = ''
      as $$
      begin
        raise exception 'forced status insert failure';
      end;
      $$;
      create trigger reject_test_status_update
      before insert on public.status_updates
      for each row execute function private.reject_test_status_update();
    `);

    await expect(
      asAuthenticatedUser(db, adminId, () =>
        callStatusUpdate(db, "in_review"),
      ),
    ).rejects.toThrow(/forced status insert failure/i);

    const state = await readState(db);
    expect(state.workflow_status).toBe("brief_submitted");
    expect(state.update_count).toBe(0);
    expect(state.updated_at).toEqual(new Date("2026-08-20T12:00:00.000Z"));
  });
});
