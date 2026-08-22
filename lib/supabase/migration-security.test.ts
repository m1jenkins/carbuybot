import { readFileSync } from "node:fs";
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
