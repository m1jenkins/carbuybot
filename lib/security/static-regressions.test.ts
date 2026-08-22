// @vitest-environment node

import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function filesUnder(path: string): string[] {
  const absolute = join(root, path);
  return readdirSync(absolute).flatMap((name) => {
    const candidate = join(absolute, name);
    return statSync(candidate).isDirectory()
      ? filesUnder(relative(root, candidate))
      : [relative(root, candidate)];
  });
}

describe("Phase 1 static security invariants", () => {
  const migrationFiles = filesUnder("supabase/migrations")
    .filter((path) => path.endsWith(".sql"))
    .sort();
  const migrationSql = migrationFiles.map(read).join("\n");
  const normalizedSql = migrationSql.replace(/\s+/g, " ");

  it("enables RLS on every public table and leaves Stripe events browser-inaccessible", () => {
    const publicTables = [
      ...migrationSql.matchAll(/create table public\.([a-z_]+)/g),
    ].map((match) => match[1]);

    expect(publicTables.length).toBeGreaterThan(0);
    for (const table of new Set(publicTables)) {
      expect(normalizedSql).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
    expect(normalizedSql).toContain(
      "revoke all on table public.stripe_events from anon, authenticated;",
    );
    expect(normalizedSql).not.toMatch(
      /create policy [\s\S]*? on public\.stripe_events/,
    );
  });

  it("keeps customer policies owner-scoped and authorization out of user metadata", () => {
    expect(normalizedSql).toContain(
      "engagements.user_id = (select auth.uid())",
    );
    expect(normalizedSql).toContain("user_id = (select auth.uid())");
    expect(normalizedSql).toContain(
      "create or replace function private.is_admin()",
    );
    expect(normalizedSql).not.toMatch(
      /user_metadata|raw_user_meta_data|auth\.jwt\(\)/i,
    );
  });

  it("reads the service-role key only in the server-only Supabase admin module", () => {
    const sourceFiles = [
      ...filesUnder("app"),
      ...filesUnder("components"),
      ...filesUnder("lib"),
      "next.config.ts",
      "proxy.ts",
    ]
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter(
        (path) =>
          !path.endsWith(".test.ts") &&
          !path.endsWith(".test.tsx"),
      );
    const readers = sourceFiles.filter((path) =>
      read(path).includes("process.env.SUPABASE_SERVICE_ROLE_KEY"),
    );

    expect(readers).toEqual(["lib/supabase/admin.ts"]);
    expect(read("lib/supabase/admin.ts")).toMatch(
      /^import "server-only";/,
    );
  });

  it("keeps Checkout one-time, test-only, and free of forbidden Stripe options", () => {
    const checkout = read("app/api/checkout/route.ts");
    const stripeClient = read("lib/stripe/client.ts");
    const fulfillment = read("lib/stripe/fulfillment.ts");

    expect(checkout).toContain('mode: "payment"');
    expect(checkout).not.toMatch(
      /automatic_tax|invoice_creation|setup_future_usage|payment_method_types|subscription_data|application_fee|transfer_data/,
    );
    expect(stripeClient).toContain("testKeyPrefixes");
    expect(stripeClient).toContain("liveKeyPrefixes");
    expect(fulfillment).toContain("if (event.livemode)");
    expect(fulfillment).toContain('session.mode !== "payment"');
  });
});

describe("review fixture isolation and indexing", () => {
  it("keeps the early JavaScript marker hydration-safe", () => {
    const layout = read("app/layout.tsx");

    expect(layout).toContain("document.documentElement.classList.add('js')");
    expect(layout).toContain('<html lang="en" suppressHydrationWarning>');
  });

  it("keeps preview modules away from privileged and payment write paths", () => {
    const previewSources = [
      ...filesUnder("app/preview"),
      ...filesUnder("components/preview"),
      ...filesUnder("lib/preview"),
    ]
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => !path.includes(".test."))
      .map(read)
      .join("\n");

    expect(previewSources).not.toMatch(
      /supabase\/admin|supabase\/server|stripe\/client|stripe\/repository|api\/checkout|onboarding\/actions|engagements\/\[id\]\/actions/,
    );
    expect(previewSources).not.toMatch(
      /online now|typing(?:\.\.\.|…)|live activity|Math\.random|setInterval|setTimeout/i,
    );
  });

  it("blocks all non-public surfaces and lists only the landing page", () => {
    const robots = read("public/robots.txt");
    const sitemap = read("public/sitemap.xml");

    for (const path of [
      "/admin",
      "/api/",
      "/auth/",
      "/checkout/",
      "/onboarding",
      "/portal",
      "/preview/",
      "/sign-in",
    ]) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
    expect([...sitemap.matchAll(/<loc>/g)]).toHaveLength(1);
    expect(sitemap).toContain("<loc>https://carbuyerbots.com/</loc>");

    for (const path of [
      "app/(customer)/layout.tsx",
      "app/admin/layout.tsx",
      "app/checkout/layout.tsx",
      "app/preview/layout.tsx",
      "app/sign-in/page.tsx",
    ]) {
      expect(read(path)).toMatch(
        /robots:\s*\{\s*index:\s*false,\s*follow:\s*false/,
      );
    }
  });
});

describe("setup and durable guidance", () => {
  const documentation = () =>
    [read("README.md"), read("docs/setup-phase-1-portal.md")].join("\n");

  it("documents exact local configuration and external setup without secrets", () => {
    const docs = documentation();
    const envExample = read(".env.example");

    for (const variable of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_APP_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_INTRO_ID",
      "STRIPE_PRICE_STANDARD_ID",
      "APP_DEMO_MODE",
    ]) {
      expect(docs).toContain(variable);
      expect(envExample).toContain(variable);
    }
    expect(docs).toContain("supabase db push --dry-run");
    expect(docs).toContain("supabase db push");
    expect(docs).toContain("/auth/callback");
    expect(docs).toContain("raw_app_meta_data");
    expect(docs).toContain("admin_users");
    expect(docs).toContain("/api/stripe/webhook");
    expect(docs).toContain("checkout.session.completed");
    expect(docs).toContain("checkout.session.async_payment_succeeded");
    expect(docs).not.toMatch(
      /\b(?:sk|rk)_live_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{24,}/,
    );
  });

  it("states the explicit Phase 1 exclusions and local-only demo contract", () => {
    const docs = documentation();
    const design = read("docs/design-language.md");

    for (const exclusion of [
      "live keys",
      "live charges",
      "Stripe Tax",
      "invoices",
      "subscriptions",
      "saved cards",
      "Connect",
    ]) {
      expect(docs.toLowerCase()).toContain(exclusion.toLowerCase());
    }
    expect(docs).toContain('APP_DEMO_MODE=true');
    expect(docs).toMatch(/local review only/i);
    expect(design).toMatch(/conversational intake/i);
    expect(design).toMatch(/hairline progress/i);
    expect(design).toMatch(/tables collapse/i);
    expect(design).toMatch(/no fake activity/i);
  });
});
