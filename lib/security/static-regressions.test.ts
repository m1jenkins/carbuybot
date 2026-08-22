// @vitest-environment node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  dirname,
  extname,
  join,
  relative,
  resolve,
} from "node:path";

import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertTestStripeKey } from "@/lib/stripe/client";
import { processEvent } from "@/lib/stripe/fulfillment";

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

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

function activePolicies(sql: string): Map<string, string> {
  const policies = new Map<string, string>();
  const statements = sql.match(
    /(?:create policy (?:"[^"]+"|[a-z_][a-z0-9_$]*)\s+on public\.[a-z_]+[\s\S]*?;|drop policy(?: if exists)? (?:"[^"]+"|[a-z_][a-z0-9_$]*)\s+on public\.[a-z_]+\s*;)/gi,
  ) ?? [];

  for (const statement of statements) {
    const normalized = normalizeSql(statement);
    const created = normalized.match(
      /^create policy (?:"([^"]+)"|([a-z_][a-z0-9_$]*)) on public\.([a-z_]+) /i,
    );
    if (created) {
      policies.set(`${created[3]}:${created[1] ?? created[2]}`, normalized);
      continue;
    }

    const dropped = normalized.match(
      /^drop policy(?: if exists)? (?:"([^"]+)"|([a-z_][a-z0-9_$]*)) on public\.([a-z_]+);$/i,
    );
    if (dropped) {
      policies.delete(`${dropped[3]}:${dropped[1] ?? dropped[2]}`);
    }
  }

  return policies;
}

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function resolveLocalImport(
  importer: string,
  specifier: string,
): string | null {
  const base = specifier.startsWith("@/")
    ? join(root, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(join(root, importer)), specifier)
      : null;
  if (!base) return null;

  const candidates = [
    base,
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) => join(base, `index${extension}`)),
  ];
  const match = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  return match ? relative(root, match).replaceAll("\\", "/") : null;
}

function runtimeImportSpecifiers(path: string): string[] {
  const source = read(path);
  const specifiers = [
    ...source.matchAll(
      /\b(?:import|export)\s+(?!type\b)(?:[^;"']*?\s+from\s+)?["']([^"']+)["']/g,
    ),
    ...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
    ...source.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g),
  ];
  return specifiers.map((match) => match[1]);
}

function localRuntimeImportGraph(entries: readonly string[]): Set<string> {
  const visited = new Set<string>();
  const queue = [...entries];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    for (const specifier of runtimeImportSpecifiers(current)) {
      const dependency = resolveLocalImport(current, specifier);
      if (dependency && !visited.has(dependency)) {
        queue.push(dependency);
      }
    }
  }

  return visited;
}

const relevantTextExtensions = new Set([
  ".css",
  ".env",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

function trackedTextFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .filter((path) => path !== "lib/security/static-regressions.test.ts")
    .filter(
      (path) =>
        path === ".env.example" ||
        relevantTextExtensions.has(extname(path).toLowerCase()),
    );
}

describe("Phase 1 static security invariants", () => {
  const migrationFiles = filesUnder("supabase/migrations")
    .filter((path) => path.endsWith(".sql"))
    .sort();
  const migrationSql = migrationFiles.map(read).join("\n");
  const normalizedSql = migrationSql.replace(/\s+/g, " ");
  const policies = activePolicies(migrationSql);

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

  it("allows only the exact reviewed customer and admin policy set", () => {
    expect([...policies.keys()].sort()).toEqual(
      [
        "admin_users:Admins can view admin assignments",
        "admin_users:Users can view their admin assignment",
        "brief_drafts:Customers can start an editable paid vehicle brief draft",
        "brief_drafts:Customers can update their editable paid vehicle brief draft",
        "brief_drafts:Customers can view their vehicle brief draft",
        "engagements:Admins can view engagements",
        "engagements:Customers can view their engagements",
        "profiles:Admins can view profiles",
        "profiles:Customers can view their profile",
        "status_updates:Admins can view status updates",
        "status_updates:Customers can view visible status updates",
        "vehicle_briefs:Admins can create vehicle briefs",
        "vehicle_briefs:Admins can update vehicle briefs",
        "vehicle_briefs:Admins can view vehicle briefs",
        "vehicle_briefs:Customers can view their vehicle briefs",
      ].sort(),
    );
  });

  it("matches every customer policy to its exact owner-scoped definition", () => {
    const expected = new Map(
      [
        [
          "profiles:Customers can view their profile",
          `create policy "Customers can view their profile"
            on public.profiles for select to authenticated
            using (id = (select auth.uid()));`,
        ],
        [
          "engagements:Customers can view their engagements",
          `create policy "Customers can view their engagements"
            on public.engagements for select to authenticated
            using (user_id = (select auth.uid()));`,
        ],
        [
          "vehicle_briefs:Customers can view their vehicle briefs",
          `create policy "Customers can view their vehicle briefs"
            on public.vehicle_briefs for select to authenticated
            using (
              exists (
                select 1 from public.engagements
                where engagements.id = vehicle_briefs.engagement_id
                  and engagements.user_id = (select auth.uid())
              )
            );`,
        ],
        [
          "status_updates:Customers can view visible status updates",
          `create policy "Customers can view visible status updates"
            on public.status_updates for select to authenticated
            using (
              customer_visible
              and exists (
                select 1 from public.engagements
                where engagements.id = status_updates.engagement_id
                  and engagements.user_id = (select auth.uid())
              )
            );`,
        ],
        [
          "admin_users:Users can view their admin assignment",
          `create policy "Users can view their admin assignment"
            on public.admin_users for select to authenticated
            using (user_id = (select auth.uid()));`,
        ],
        [
          "brief_drafts:Customers can view their vehicle brief draft",
          `create policy "Customers can view their vehicle brief draft"
            on public.brief_drafts for select to authenticated
            using (
              exists (
                select 1 from public.engagements
                where engagements.id = brief_drafts.engagement_id
                  and engagements.user_id = (select auth.uid())
                  and engagements.payment_status = 'paid'
              )
            );`,
        ],
        [
          "brief_drafts:Customers can start an editable paid vehicle brief draft",
          `create policy "Customers can start an editable paid vehicle brief draft"
            on public.brief_drafts for insert to authenticated
            with check (
              exists (
                select 1 from public.engagements
                where engagements.id = brief_drafts.engagement_id
                  and engagements.user_id = (select auth.uid())
                  and engagements.payment_status = 'paid'
                  and engagements.workflow_status in ('awaiting_brief', 'brief_submitted')
              )
            );`,
        ],
        [
          "brief_drafts:Customers can update their editable paid vehicle brief draft",
          `create policy "Customers can update their editable paid vehicle brief draft"
            on public.brief_drafts for update to authenticated
            using (
              exists (
                select 1 from public.engagements
                where engagements.id = brief_drafts.engagement_id
                  and engagements.user_id = (select auth.uid())
                  and engagements.payment_status = 'paid'
                  and engagements.workflow_status in ('awaiting_brief', 'brief_submitted')
              )
            )
            with check (
              exists (
                select 1 from public.engagements
                where engagements.id = brief_drafts.engagement_id
                  and engagements.user_id = (select auth.uid())
                  and engagements.payment_status = 'paid'
                  and engagements.workflow_status in ('awaiting_brief', 'brief_submitted')
              )
            );`,
        ],
      ].map(([key, sql]) => [key, normalizeSql(sql)]),
    );

    for (const [key, definition] of expected) {
      expect(policies.get(key), key).toBe(definition);
    }
  });

  it("keeps authorization out of mutable user metadata", () => {
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

  it("executes the Stripe test-key and live-event guards", async () => {
    expect(() => assertTestStripeKey("sk_live_review_detector")).toThrow(
      /test-mode/i,
    );

    const persist = vi.fn(async () => true);
    const liveEvent = {
      data: { object: {} },
      id: "evt_live_review_detector",
      livemode: true,
      type: "checkout.session.completed",
    } as Stripe.Event;
    await expect(processEvent(liveEvent, persist)).rejects.toThrow(
      /test-mode/i,
    );
    expect(persist).not.toHaveBeenCalled();
  });

  it("keeps Checkout one-time and statically excludes forbidden options and client imports", () => {
    const checkout = read("app/api/checkout/route.ts");
    const clientModules = [
      ...filesUnder("app"),
      ...filesUnder("components"),
    ]
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => read(path).match(/^\s*["']use client["'];/))
      .map(read)
      .join("\n");

    expect(checkout).toContain('mode: "payment"');
    expect(checkout).not.toMatch(
      /automatic_tax|invoice_creation|setup_future_usage|payment_method_types|subscription_data|application_fee|transfer_data/,
    );
    expect(clientModules).not.toMatch(
      /(?:@\/|\.\.?\/).*lib\/stripe\/(?:client|fulfillment|repository)/,
    );
  });
});

describe("review fixture isolation and indexing", () => {
  it("keeps the early JavaScript marker hydration-safe", () => {
    const layout = read("app/layout.tsx");

    expect(layout).toContain("document.documentElement.classList.add('js')");
    expect(layout).toContain('<html lang="en" suppressHydrationWarning>');
  });

  it("keeps the full transitive preview import graph away from write paths", () => {
    const previewEntries = [
      ...filesUnder("app/preview"),
      ...filesUnder("components/preview"),
      ...filesUnder("lib/preview"),
    ]
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => !path.includes(".test."));
    const graph = localRuntimeImportGraph(previewEntries);
    const prohibitedModules = new Set([
      "app/(customer)/onboarding/actions.ts",
      "app/admin/engagements/[id]/actions.ts",
      "app/api/checkout/route.ts",
      "lib/stripe/client.ts",
      "lib/stripe/repository.ts",
      "lib/supabase/admin.ts",
      "lib/supabase/server.ts",
    ]);

    expect([...graph].filter((path) => prohibitedModules.has(path))).toEqual(
      [],
    );
    expect(graph).toContain("components/admin/engagement-table.tsx");
    expect(graph).toContain("lib/admin/engagement-queries.ts");

    const previewSources = [...graph].map(read).join("\n");
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

describe("repository secret scanning", () => {
  it("finds no plausible committed production or test secrets", () => {
    const detectors = [
      {
        name: "Stripe API key",
        pattern: /\b(?:rk|rkcs|sk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
      },
      {
        name: "Stripe webhook secret",
        pattern: /\bwhsec_[A-Za-z0-9]{24,}\b/g,
      },
      {
        name: "Supabase secret key",
        pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
      },
      {
        name: "JWT",
        pattern:
          /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      },
      {
        name: "GitHub token",
        pattern: /\bgh[opusr]_[A-Za-z0-9]{30,}\b/g,
      },
      {
        name: "AWS access key",
        pattern: /\bAKIA[0-9A-Z]{16}\b/g,
      },
      {
        name: "credentialed Postgres URL",
        pattern: /\bpostgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]{8,}@/g,
      },
      {
        name: "private key",
        pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/g,
      },
    ];
    const explicitPlaceholders = new Set([
      "sk_test_your-test-secret-key",
      "whsec_your-test-webhook-secret",
    ]);
    const findings: string[] = [];

    for (const path of trackedTextFiles()) {
      const source = read(path);
      for (const detector of detectors) {
        for (const match of source.matchAll(detector.pattern)) {
          if (!explicitPlaceholders.has(match[0])) {
            findings.push(`${detector.name}: ${path}`);
          }
        }
      }
    }

    expect(findings).toEqual([]);
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
