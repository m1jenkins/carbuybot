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

describe("admin workflow migration security", () => {
  it("defines a fixed-path authenticated security-invoker RPC", () => {
    expect(normalizedSql).toContain(
      "create or replace function public.update_engagement_status(",
    );
    expect(normalizedSql).toContain("security invoker set search_path = ''");
    expect(normalizedSql).toContain(
      "revoke all on function public.update_engagement_status(uuid, text, text, text) from public, anon, service_role;",
    );
    expect(normalizedSql).toContain(
      "grant execute on function public.update_engagement_status(uuid, text, text, text) to authenticated;",
    );

    const workflowFunction = normalizedSql.match(
      /create or replace function public\.update_engagement_status\([\s\S]*?\$\$;/,
    )?.[0];
    expect(workflowFunction).toBeDefined();
    expect(workflowFunction).not.toContain("security definer");
    expect(workflowFunction).toContain("if not (select private.is_admin())");
    expect(workflowFunction).toContain("for update");
  });

  it("validates transitions and writes only workflow state plus one visible note", () => {
    const workflowFunction = normalizedSql.match(
      /create or replace function public\.update_engagement_status\([\s\S]*?\$\$;/,
    )?.[0];
    expect(workflowFunction).toBeDefined();
    expect(workflowFunction).toContain("v_current_status = p_next_status");
    expect(workflowFunction).toContain(
      "update public.engagements set workflow_status = p_next_status, updated_at = pg_catalog.now()",
    );
    expect(workflowFunction).toContain(
      "insert into public.status_updates ( engagement_id, author_id, status, title, note, customer_visible )",
    );
    expect(workflowFunction).toContain("(select auth.uid())");
    expect(workflowFunction).toContain("true");
    expect(workflowFunction).not.toContain("payment_status = p_");
    expect(workflowFunction).not.toContain("customer_email = p_");
  });
});
