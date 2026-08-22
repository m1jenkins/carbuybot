// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationName = readdirSync(
  join(process.cwd(), "supabase/migrations"),
).find((name) => name.endsWith("_admin_engagement_workflow.sql"));
const migration = migrationName
  ? readFileSync(
      join(process.cwd(), "supabase/migrations", migrationName),
      "utf8",
    )
  : "";
const normalizedSql = migration.replace(/\s+/g, " ");
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

describe("admin workflow migration security", () => {
  it("delegates the exposed invoker RPC to a fixed-path private definer", () => {
    expect(normalizedSql).toContain(
      "create or replace function public.update_engagement_status(",
    );
    expect(normalizedSql).toContain(
      "revoke all on function public.update_engagement_status(uuid, text, text, text) from public, anon, authenticated, service_role;",
    );
    expect(normalizedSql).toContain(
      "grant execute on function public.update_engagement_status(uuid, text, text, text) to authenticated;",
    );

    const workflowFunction = normalizedSql.match(
      /create or replace function public\.update_engagement_status\([\s\S]*?\$\$;/,
    )?.[0];
    expect(workflowFunction).toBeDefined();
    expect(workflowFunction).toContain("security invoker set search_path = ''");
    expect(workflowFunction).not.toContain("security definer");
    expect(workflowFunction).toContain("if not (select private.is_admin())");
    expect(workflowFunction).toContain(
      "return private.update_engagement_status(",
    );
    expect(workflowFunction).not.toContain("public.engagements");
    expect(workflowFunction).not.toContain("public.status_updates");
    expect(workflowFunction).not.toContain("for update");

    const privateFunction = normalizedSql.match(
      /create or replace function private\.update_engagement_status\([\s\S]*?\$\$;/,
    )?.[0];
    expect(privateFunction).toBeDefined();
    expect(privateFunction).toContain("security definer set search_path = ''");
    expect(privateFunction).toContain("(select auth.uid())");
    expect(privateFunction).toContain("if not (select private.is_admin())");
    expect(privateFunction).toContain("for update");
    expect(normalizedSql).toContain(
      "revoke all on function private.update_engagement_status(uuid, text, text, text) from public, anon, authenticated, service_role;",
    );
    expect(normalizedSql).toContain(
      "grant execute on function private.update_engagement_status(uuid, text, text, text) to authenticated;",
    );
  });

  it("requires paid state and a brief in the hardened private transition", () => {
    const privateFunction = normalizedFinalReviewSql.match(
      /create or replace function private\.update_engagement_status\([\s\S]*?\$\$;/,
    )?.[0];
    expect(privateFunction).toBeDefined();
    expect(privateFunction).toContain("security definer set search_path = ''");
    expect(privateFunction).toContain("payment_status");
    expect(privateFunction).toContain("public.vehicle_briefs");
    expect(privateFunction).not.toContain(
      "p_next_status in ('brief_submitted', 'cancelled')",
    );
  });

  it("revokes direct writes and keeps transition writes inside the private helper", () => {
    const privateFunction = normalizedSql.match(
      /create or replace function private\.update_engagement_status\([\s\S]*?\$\$;/,
    )?.[0];
    expect(privateFunction).toBeDefined();
    expect(normalizedSql).not.toMatch(/set_config|current_setting/);
    expect(normalizedSql).toContain(
      "revoke update (workflow_status, onboarding_completed_at, updated_at) on table public.engagements from authenticated;",
    );
    expect(normalizedSql).toContain(
      "revoke insert on table public.status_updates from authenticated;",
    );
    expect(normalizedSql).toContain(
      'drop policy if exists "Admins can update engagements" on public.engagements;',
    );
    expect(normalizedSql).toContain(
      'drop policy if exists "Admins can update engagements through workflow RPC" on public.engagements;',
    );
    expect(normalizedSql).toContain(
      'drop policy if exists "Admins can create status updates" on public.status_updates;',
    );
    expect(normalizedSql).toContain(
      'drop policy if exists "Admins can create status updates through workflow RPC" on public.status_updates;',
    );
    expect(normalizedSql).not.toContain(
      "create policy \"Admins can update engagements",
    );
    expect(normalizedSql).not.toContain(
      "create policy \"Admins can create status updates",
    );
    expect(privateFunction).toContain("v_current_status = p_next_status");
    expect(privateFunction).toContain(
      "update public.engagements set workflow_status = p_next_status, updated_at = pg_catalog.now()",
    );
    expect(privateFunction).toContain(
      "insert into public.status_updates ( engagement_id, author_id, status, title, note, customer_visible )",
    );
    expect(privateFunction).toContain("v_author_id");
    expect(privateFunction).toContain("true");
    expect(privateFunction).not.toContain("payment_status = p_");
    expect(privateFunction).not.toContain("customer_email = p_");
  });
});
