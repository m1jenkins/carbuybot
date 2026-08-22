import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260822071928_phase_1_portal.sql",
  ),
  "utf8",
);
const config = readFileSync(
  join(process.cwd(), "supabase/config.toml"),
  "utf8",
);
const normalizedSql = migration.replace(/\s+/g, " ");
const stripeFulfillmentMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_stripe_fulfillment.sql"));
const stripeFulfillmentMigration = stripeFulfillmentMigrationName
  ? readFileSync(
      join(
        process.cwd(),
        "supabase/migrations",
        stripeFulfillmentMigrationName,
      ),
      "utf8",
    )
  : "";
const normalizedStripeSql = stripeFulfillmentMigration.replace(/\s+/g, " ");
const conversationalIntakeMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_conversational_intake.sql"));
const conversationalIntakeMigration = conversationalIntakeMigrationName
  ? readFileSync(
      join(
        process.cwd(),
        "supabase/migrations",
        conversationalIntakeMigrationName,
      ),
      "utf8",
    )
  : "";
const normalizedIntakeSql = conversationalIntakeMigration.replace(/\s+/g, " ");
const intakeHardeningMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_harden_conversational_intake.sql"));
const intakeHardeningMigration = intakeHardeningMigrationName
  ? readFileSync(
      join(
        process.cwd(),
        "supabase/migrations",
        intakeHardeningMigrationName,
      ),
      "utf8",
    )
  : "";
const normalizedIntakeHardeningSql = intakeHardeningMigration.replace(
  /\s+/g,
  " ",
);
const briefRevisionsMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_brief_revisions.sql"));
const briefRevisionsMigration = briefRevisionsMigrationName
  ? readFileSync(
      join(
        process.cwd(),
        "supabase/migrations",
        briefRevisionsMigrationName,
      ),
      "utf8",
    )
  : "";
const normalizedBriefRevisionsSql = briefRevisionsMigration.replace(
  /\s+/g,
  " ",
);
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
const normalizedBriefRevisionConsistencySql =
  briefRevisionConsistencyMigration.replace(/\s+/g, " ");
const finalReviewMigrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_final_review_fixes.sql"));
const finalReviewMigration = finalReviewMigrationName
  ? readFileSync(
      join(process.cwd(), "supabase/migrations", finalReviewMigrationName),
      "utf8",
    )
  : "";
const normalizedFinalReviewSql = finalReviewMigration.replace(/\s+/g, " ");
const emailAuthConfig = config.match(
  /\[auth\.email\]([\s\S]*?)(?=\n\[|$)/,
)?.[1];

describe("Supabase authentication security", () => {
  it("requires mailbox confirmation for local and deployable auth config", () => {
    expect(emailAuthConfig).toMatch(/^enable_confirmations\s*=\s*true$/m);
  });
});

describe("engagement database privileges", () => {
  it("limits authenticated engagement updates to operational columns", () => {
    expect(normalizedSql).toContain(
      "grant update (workflow_status, onboarding_completed_at, updated_at) " +
        "on table public.engagements to authenticated;",
    );
    expect(normalizedSql).not.toContain(
      "grant select, update on table public.engagements to authenticated;",
    );
  });

  it("keeps the atomic claim RPC service-role only and security invoker", () => {
    expect(normalizedSql).toContain(
      "create or replace function public.claim_paid_engagements(",
    );
    expect(normalizedSql).toContain("security invoker set search_path = ''");
    expect(normalizedSql).toContain(
      "revoke all on function public.claim_paid_engagements(uuid, text) " +
        "from public, anon, authenticated;",
    );
    expect(normalizedSql).toContain(
      "grant execute on function public.claim_paid_engagements(uuid, text) " +
        "to service_role;",
    );

    const claimFunction = normalizedSql.match(
      /create or replace function public\.claim_paid_engagements\([\s\S]*?\$\$;/,
    )?.[0];
    expect(claimFunction).toBeDefined();
    expect(claimFunction).not.toContain("security definer");
    expect(claimFunction).toContain("insert into public.profiles");
    expect(claimFunction).toContain("update public.engagements");
  });

  it("makes webhook event insertion and fulfillment one service-role transaction", () => {
    expect(normalizedStripeSql).toContain(
      "create or replace function public.fulfill_stripe_event(",
    );
    expect(normalizedStripeSql).toContain(
      "security invoker set search_path = ''",
    );
    expect(normalizedStripeSql).toContain(
      "insert into public.stripe_events (event_id, event_type)",
    );
    expect(normalizedStripeSql).toContain("on conflict (event_id) do nothing");
    expect(normalizedStripeSql).toContain("update public.engagements");
    expect(normalizedStripeSql).toContain(
      "raise exception 'Matching pending engagement was not found'",
    );
    expect(normalizedStripeSql).toContain(
      "revoke all on function public.fulfill_stripe_event(text, text, boolean, uuid, text, text, text, text, bigint, text, text) from public, anon, authenticated;",
    );
    expect(normalizedStripeSql).toContain(
      "grant execute on function public.fulfill_stripe_event(text, text, boolean, uuid, text, text, text, text, bigint, text, text) to service_role;",
    );

    const fulfillmentFunction = normalizedStripeSql.match(
      /create or replace function public\.fulfill_stripe_event\([\s\S]*?\$\$;/,
    )?.[0];
    expect(fulfillmentFunction).toBeDefined();
    expect(fulfillmentFunction).not.toContain("security definer");
    expect(fulfillmentFunction).toContain(
      "insert into public.stripe_events (event_id, event_type)",
    );
    expect(fulfillmentFunction).toContain(
      "on conflict (event_id) do nothing",
    );
    expect(fulfillmentFunction).toContain("return false;");
    expect(fulfillmentFunction).toContain("update public.engagements");
    expect(fulfillmentFunction).toContain(
      "raise exception 'Matching pending engagement was not found'",
    );
    expect(fulfillmentFunction!.indexOf("insert into public.stripe_events")).toBeLessThan(
      fulfillmentFunction!.indexOf("update public.engagements"),
    );
  });
});

describe("database/domain constraint parity", () => {
  it("caps normalized emails and budget cents at application limits", () => {
    expect(normalizedSql).toContain("pg_catalog.char_length(email) <= 320");
    expect(normalizedSql).toContain(
      "pg_catalog.char_length(customer_email) <= 320",
    );
    expect(normalizedSql).toContain(
      "budget_cents between 1 and 9007199254740991",
    );
  });

  it("validates brief arrays as normalized one-dimensional sets", () => {
    expect(normalizedSql).toContain(
      "create or replace function private.is_valid_brief_text_array(",
    );
    expect(normalizedSql).toContain(
      "pg_catalog.array_ndims(candidate) = 1",
    );
    expect(normalizedSql).toContain(
      "pg_catalog.array_position(candidate, null) is null",
    );
    expect(normalizedSql).toContain(
      "item.value = pg_catalog.btrim(item.value)",
    );
    expect(normalizedSql).toContain(
      "pg_catalog.char_length(item.value) between 1 and 100",
    );
    expect(normalizedSql).toContain("having pg_catalog.count(*) > 1");
    expect(normalizedSql).toContain(
      "check (private.is_valid_brief_text_array(colors))",
    );
    expect(normalizedSql).toContain(
      "check (private.is_valid_brief_text_array(options))",
    );
    expect(normalizedSql).toContain(
      "check (private.is_valid_brief_text_array(deal_breakers))",
    );
  });
});

describe("conversational intake security", () => {
  it("protects paid customer drafts with RLS and least-privilege grants", () => {
    expect(normalizedIntakeSql).toContain(
      "create table public.brief_drafts (",
    );
    expect(normalizedIntakeSql).toContain(
      "alter table public.brief_drafts enable row level security;",
    );
    expect(normalizedIntakeSql).toContain(
      "revoke all on table public.brief_drafts from anon, authenticated;",
    );
    expect(normalizedIntakeSql).toContain(
      "grant select, insert on table public.brief_drafts to authenticated;",
    );
    expect(normalizedIntakeSql).toContain(
      "grant update (answers, current_question_id, updated_at) on table public.brief_drafts to authenticated;",
    );
    expect(normalizedIntakeSql).not.toContain(
      "grant select, insert, update on table public.brief_drafts to authenticated;",
    );
    expect(normalizedIntakeSql).not.toContain(
      "grant delete on table public.brief_drafts to authenticated;",
    );
    expect(normalizedIntakeSql).toContain(
      "engagements.user_id = (select auth.uid())",
    );
    expect(normalizedIntakeSql).toContain(
      "engagements.payment_status = 'paid'",
    );
    expect(normalizedIntakeSql).toContain(
      "engagements.workflow_status = 'awaiting_brief'",
    );
  });

  it("keeps finalization service-role only and transactional", () => {
    expect(normalizedIntakeSql).toContain(
      "create or replace function public.finalize_vehicle_brief(",
    );
    expect(normalizedIntakeSql).toContain(
      "security invoker set search_path = ''",
    );
    expect(normalizedIntakeSql).toContain(
      "revoke all on function public.finalize_vehicle_brief(uuid, uuid, jsonb) from public, anon, authenticated;",
    );
    expect(normalizedIntakeSql).toContain(
      "grant execute on function public.finalize_vehicle_brief(uuid, uuid, jsonb) to service_role;",
    );

    const finalizationFunction = normalizedIntakeSql.match(
      /create or replace function public\.finalize_vehicle_brief\([\s\S]*?\$\$;/,
    )?.[0];
    expect(finalizationFunction).toBeDefined();
    expect(finalizationFunction).not.toContain("security definer");
    expect(finalizationFunction).toContain("for update");
    expect(finalizationFunction).toContain("payment_status = 'paid'");
    expect(finalizationFunction).toContain(
      "workflow_status = 'awaiting_brief'",
    );
    expect(finalizationFunction).toContain(
      "insert into public.vehicle_briefs",
    );
    expect(finalizationFunction).toContain("on conflict (engagement_id)");
    expect(finalizationFunction).toContain("update public.engagements");
    expect(finalizationFunction).toContain(
      "insert into public.status_updates",
    );
    expect(finalizationFunction).toContain(
      "delete from public.brief_drafts",
    );
    expect(
      finalizationFunction!.indexOf("insert into public.vehicle_briefs"),
    ).toBeLessThan(finalizationFunction!.indexOf("update public.engagements"));
    expect(
      finalizationFunction!.indexOf("update public.engagements"),
    ).toBeLessThan(
      finalizationFunction!.indexOf("insert into public.status_updates"),
    );
    expect(
      finalizationFunction!.indexOf("insert into public.status_updates"),
    ).toBeLessThan(
      finalizationFunction!.indexOf("delete from public.brief_drafts"),
    );
  });
});

describe("conversational intake review hardening", () => {
  it("saves exactly one answer through an authenticated security-invoker RPC", () => {
    expect(normalizedIntakeHardeningSql).toContain(
      "create or replace function public.save_brief_answer(",
    );
    expect(normalizedIntakeHardeningSql).toContain(
      "security invoker set search_path = ''",
    );
    expect(normalizedIntakeHardeningSql).toContain(
      "revoke all on function public.save_brief_answer(uuid, text, jsonb, text) from public, anon;",
    );
    expect(normalizedIntakeHardeningSql).toContain(
      "grant execute on function public.save_brief_answer(uuid, text, jsonb, text) to authenticated;",
    );
    expect(normalizedIntakeHardeningSql).not.toContain(
      "grant execute on function public.save_brief_answer(uuid, text, jsonb, text) to anon;",
    );

    const saveFunction = normalizedIntakeHardeningSql.match(
      /create or replace function public\.save_brief_answer\([\s\S]*?\$\$;/,
    )?.[0];
    expect(saveFunction).toBeDefined();
    expect(saveFunction).not.toContain("security definer");
    expect(saveFunction).toContain("(select auth.uid())");
    expect(saveFunction).toContain("payment_status = 'paid'");
    expect(saveFunction).toContain("workflow_status = 'awaiting_brief'");
    expect(saveFunction).toContain(
      "brief_drafts.answers || pg_catalog.jsonb_build_object(",
    );
    expect(saveFunction).toContain("on conflict (engagement_id) do update");
  });

  it("removes every authenticated vehicle-brief write path", () => {
    expect(normalizedIntakeHardeningSql).toContain(
      "revoke insert, update on table public.vehicle_briefs from authenticated;",
    );
    expect(normalizedIntakeHardeningSql).toContain(
      'drop policy if exists "Customers can create vehicle briefs for paid engagements" on public.vehicle_briefs;',
    );
    expect(normalizedIntakeHardeningSql).toContain(
      'drop policy if exists "Customers can update vehicle briefs for paid engagements" on public.vehicle_briefs;',
    );
    expect(normalizedIntakeHardeningSql).not.toContain(
      "grant insert on table public.vehicle_briefs to authenticated;",
    );
  });

  it("finalizes only the locked draft and accepts no separate brief payload", () => {
    expect(normalizedIntakeHardeningSql).toContain(
      "drop function public.finalize_vehicle_brief(uuid, uuid, jsonb);",
    );
    expect(normalizedIntakeHardeningSql).toContain(
      "create or replace function public.finalize_vehicle_brief( p_engagement_id uuid, p_user_id uuid )",
    );
    expect(normalizedIntakeHardeningSql).toContain(
      "revoke all on function public.finalize_vehicle_brief(uuid, uuid) from public, anon, authenticated;",
    );
    expect(normalizedIntakeHardeningSql).toContain(
      "grant execute on function public.finalize_vehicle_brief(uuid, uuid) to service_role;",
    );

    const finalizationFunction = normalizedIntakeHardeningSql.match(
      /create or replace function public\.finalize_vehicle_brief\([\s\S]*?\$\$;/,
    )?.[0];
    expect(finalizationFunction).toBeDefined();
    expect(finalizationFunction).not.toContain("p_brief");
    expect(finalizationFunction).toContain(
      "into v_draft from public.brief_drafts",
    );
    expect(finalizationFunction).toContain("for update");
    expect(finalizationFunction).toContain("v_draft.answers");
    expect(finalizationFunction).toContain(
      "insert into public.vehicle_briefs",
    );
  });

  it("serializes answer saves and finalization for the same engagement", () => {
    const engagementLock =
      "pg_catalog.pg_advisory_xact_lock( pg_catalog.hashtextextended(p_engagement_id::text, 0) )";
    const saveFunction = normalizedIntakeHardeningSql.match(
      /create or replace function public\.save_brief_answer\([\s\S]*?\$\$;/,
    )?.[0];
    const finalizationFunction = normalizedIntakeHardeningSql.match(
      /create or replace function public\.finalize_vehicle_brief\([\s\S]*?\$\$;/,
    )?.[0];

    expect(saveFunction).toContain(engagementLock);
    expect(finalizationFunction).toContain(engagementLock);
  });
});

describe("submitted brief revision security", () => {
  it("opens draft writes only for the two editable workflow stages", () => {
    expect(normalizedBriefRevisionsSql).toContain(
      'drop policy "Customers can start a paid vehicle brief draft" on public.brief_drafts;',
    );
    expect(normalizedBriefRevisionsSql).toContain(
      'drop policy "Customers can update their paid vehicle brief draft" on public.brief_drafts;',
    );
    expect(normalizedBriefRevisionsSql).toContain(
      "engagements.workflow_status in ('awaiting_brief', 'brief_submitted')",
    );
    expect(normalizedBriefRevisionsSql).not.toContain(
      "grant insert, update on table public.vehicle_briefs to authenticated",
    );
  });

  it("keeps answer saves authenticated and finalization service-role only", () => {
    expect(normalizedBriefRevisionsSql).toContain(
      "create or replace function public.save_brief_answer(",
    );
    expect(normalizedBriefRevisionsSql).toContain(
      "security invoker set search_path = ''",
    );
    expect(normalizedBriefRevisionsSql).toContain(
      "grant execute on function public.save_brief_answer(uuid, text, jsonb, text) to authenticated;",
    );
    expect(normalizedBriefRevisionsSql).toContain(
      "grant execute on function public.finalize_vehicle_brief(uuid, uuid) to service_role;",
    );

    const finalizationFunction = normalizedBriefRevisionsSql.match(
      /create or replace function public\.finalize_vehicle_brief\([\s\S]*?\$\$;/,
    )?.[0];
    expect(finalizationFunction).toBeDefined();
    expect(finalizationFunction).not.toContain("security definer");
    expect(finalizationFunction).not.toContain(
      "delete from public.brief_drafts",
    );
    expect(finalizationFunction).toContain(
      "target_engagement.workflow_status = 'brief_submitted'",
    );
    expect(finalizationFunction).toContain("'Brief updated'");
  });

  it("backfills editable submitted briefs into conversational drafts", () => {
    expect(normalizedBriefRevisionsSql).toContain(
      "insert into public.brief_drafts",
    );
    expect(normalizedBriefRevisionsSql).toContain(
      "pg_catalog.jsonb_build_object(",
    );
    expect(normalizedBriefRevisionsSql).toContain(
      "engagements.workflow_status = 'brief_submitted'",
    );
    expect(normalizedBriefRevisionsSql).toContain(
      "on conflict (engagement_id) do nothing",
    );
  });
});

describe("brief revision consistency hardening", () => {
  it("adds a server-owned baseline and monotonic progress index", () => {
    expect(normalizedBriefRevisionConsistencySql).toContain(
      "add column baseline_answers jsonb",
    );
    expect(normalizedBriefRevisionConsistencySql).toContain(
      "add column progress_index smallint not null default -1",
    );
    expect(normalizedBriefRevisionConsistencySql).not.toContain(
      "grant update (baseline_answers",
    );
    expect(normalizedBriefRevisionConsistencySql).toContain(
      "baseline_answers = pg_catalog.jsonb_build_object(",
    );
  });

  it("advances the cursor only for a newer server-derived question index", () => {
    const saveFunction = normalizedBriefRevisionConsistencySql.match(
      /create or replace function public\.save_brief_answer\([\s\S]*?\$\$;/,
    )?.[0];
    expect(saveFunction).toBeDefined();
    expect(saveFunction).not.toContain("security definer");
    expect(saveFunction).toContain(
      "v_progress_index := case p_question_id",
    );
    expect(saveFunction).toContain(
      "when v_progress_index > brief_drafts.progress_index",
    );
    expect(saveFunction).toContain(
      "greatest( brief_drafts.progress_index, v_progress_index )",
    );
  });

  it("emits visible activity only when the locked normalized brief changed", () => {
    const finalizationFunction = normalizedBriefRevisionConsistencySql.match(
      /create or replace function public\.finalize_vehicle_brief\([\s\S]*?\$\$;/,
    )?.[0];
    expect(finalizationFunction).toBeDefined();
    expect(finalizationFunction).not.toContain("security definer");
    expect(finalizationFunction).toContain(
      "v_draft.baseline_answers is distinct from v_normalized_answers",
    );
    expect(finalizationFunction).toContain(
      "if target_engagement.workflow_status = 'awaiting_brief' or v_has_changes then",
    );
    expect(finalizationFunction).toContain(
      "baseline_answers = v_normalized_answers",
    );
    expect(normalizedBriefRevisionConsistencySql).toContain(
      "grant execute on function public.finalize_vehicle_brief(uuid, uuid) to service_role;",
    );
  });
});

describe("final payment and revision hardening", () => {
  it("backfills introductory slots without narrowing unbounded row numbers", () => {
    expect(normalizedFinalReviewSql).toContain(
      "pg_catalog.row_number() over (",
    );
    expect(normalizedFinalReviewSql).not.toContain(")::smallint as slot");
    expect(normalizedFinalReviewSql).toContain(
      "set intro_slot = eligible.slot::smallint",
    );
  });

  it("keeps every public payment RPC invoker-only and service-role-only", () => {
    for (const signature of [
      "reserve_checkout_engagement(text, text, text)",
      "expire_stripe_checkout(text, uuid, text, text)",
      "refund_stripe_payment(text, text)",
    ]) {
      expect(normalizedFinalReviewSql).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated;`,
      );
      expect(normalizedFinalReviewSql).toContain(
        `grant execute on function public.${signature} to service_role;`,
      );
    }
    const publicFunctions = normalizedFinalReviewSql.match(
      /create or replace function public\.(?:reserve_checkout_engagement|expire_stripe_checkout|refund_stripe_payment)\([\s\S]*?\$\$;/g,
    );
    expect(publicFunctions).toHaveLength(3);
    for (const fn of publicFunctions ?? []) {
      expect(fn).toContain("security invoker");
      expect(fn).not.toContain("security definer");
      expect(fn).toContain("set search_path = ''");
    }
  });

  it("removes browser draft writes and delegates through a fixed-path private helper", () => {
    expect(normalizedFinalReviewSql).toContain(
      "revoke insert, update on table public.brief_drafts from authenticated;",
    );
    const publicSave = normalizedFinalReviewSql.match(
      /create or replace function public\.save_brief_answer\([\s\S]*?\$\$;/,
    )?.[0];
    const privateSave = normalizedFinalReviewSql.match(
      /create or replace function private\.save_brief_answer\([\s\S]*?\$\$;/,
    )?.[0];
    expect(publicSave).toContain("security invoker");
    expect(publicSave).toContain("private.save_brief_answer(");
    expect(publicSave).not.toContain("security definer");
    expect(privateSave).toContain("security definer");
    expect(privateSave).toContain("set search_path = ''");
  });
});
