import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const queueQuery = {
    order: vi.fn(),
    select: vi.fn(),
  };
  const engagementQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };
  const briefQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };
  const updatesQuery = {
    eq: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  };

  return {
    briefQuery,
    createServerClient: vi.fn(),
    engagementQuery,
    from: vi.fn(),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    queueQuery,
    requireAdmin: vi.fn(),
    signOut: vi.fn(),
    updateEngagementStatus: vi.fn(),
    updatesQuery,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/auth/admin", () => ({
  hasSupabaseConfiguration: () =>
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
    ),
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("./engagements/[id]/actions", () => ({
  updateEngagementStatus: mocks.updateEngagementStatus,
}));

import AdminLayout from "./layout";
import AdminPage from "./page";
import EngagementPage from "./engagements/[id]/page";

const id = "a6204b70-c308-40e8-b87f-30843d48cb79";
const engagement = {
  amount_cents: 34_900,
  created_at: "2026-08-20T12:00:00.000Z",
  currency: "usd",
  customer_email: "buyer@example.com",
  id,
  payment_status: "paid",
  profiles: { full_name: "Jordan Lee" },
  updated_at: "2026-08-22T12:00:00.000Z",
  vehicle_briefs: {
    city: "Austin",
    make: "Genesis",
    model: "GV80",
    state: "TX",
    year_max: 2025,
    year_min: 2024,
  },
  workflow_status: "brief_submitted",
};

const brief = {
  budget_cents: 6_000_000,
  city: "Austin",
  colors: ["Black"],
  condition: "either",
  consent: true,
  created_at: "2026-08-20T13:00:00.000Z",
  deal_breakers: [],
  financing_preference: "undecided",
  has_trade_in: false,
  make: "Genesis",
  model: "GV80",
  notes: null,
  options: ["AWD"],
  postal_code: "78701",
  search_radius_miles: 100,
  state: "TX",
  timeline: "within_30_days",
  trade_in_details: null,
  trim: "Prestige",
  updated_at: "2026-08-22T14:00:00.000Z",
  year_max: 2025,
  year_min: 2024,
};

describe("admin route data access", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

    mocks.requireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" });
    mocks.signOut.mockResolvedValue({ error: null });

    mocks.queueQuery.select.mockReturnValue(mocks.queueQuery);
    mocks.queueQuery.order.mockResolvedValue({
      data: [engagement],
      error: null,
    });
    mocks.engagementQuery.select.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.eq.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.maybeSingle.mockResolvedValue({
      data: engagement,
      error: null,
    });
    mocks.briefQuery.select.mockReturnValue(mocks.briefQuery);
    mocks.briefQuery.eq.mockReturnValue(mocks.briefQuery);
    mocks.briefQuery.maybeSingle.mockResolvedValue({
      data: brief,
      error: null,
    });
    mocks.updatesQuery.select.mockReturnValue(mocks.updatesQuery);
    mocks.updatesQuery.eq.mockReturnValue(mocks.updatesQuery);
    mocks.updatesQuery.order.mockResolvedValue({
      data: [
        {
          author_id: "admin-1",
          created_at: "2026-08-22T15:00:00.000Z",
          customer_visible: true,
          id: "update-1",
          note: "We are reviewing the brief.",
          status: "brief_submitted",
          title: "Brief received",
        },
      ],
      error: null,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === "engagements") {
        return mocks.engagementQuery;
      }
      if (table === "vehicle_briefs") return mocks.briefQuery;
      if (table === "status_updates") return mocks.updatesQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createServerClient.mockResolvedValue({
      auth: { signOut: mocks.signOut },
      from: mocks.from,
    });
  });

  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it("renders a safe setup state before attempting authorization", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    render(
      await AdminLayout({
        children: <p>Secret queue</p>,
      }),
    );

    expect(
      screen.getByRole("heading", { name: /admin access is not configured/i }),
    ).toBeVisible();
    expect(screen.queryByText("Secret queue")).not.toBeInTheDocument();
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
  });

  it("protects the configured layout before rendering children", async () => {
    render(
      await AdminLayout({
        children: <p>Protected queue</p>,
      }),
    );

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(screen.getByText("Protected queue")).toBeVisible();
    expect(screen.getByText(/admin console/i)).toBeVisible();
  });

  it("loads the queue through the authenticated RLS client", async () => {
    mocks.from.mockReturnValueOnce(mocks.queueQuery);

    render(await AdminPage());

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.createServerClient).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("engagements");
    expect(mocks.queueQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(screen.getByRole("link", { name: /Genesis GV80/i })).toBeVisible();
  });

  it("loads full detail and history through the authenticated RLS client", async () => {
    render(
      await EngagementPage({
        params: Promise.resolve({ id }),
      }),
    );

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.createServerClient).toHaveBeenCalledOnce();
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      "engagements",
      "vehicle_briefs",
      "status_updates",
    ]);
    expect(mocks.engagementQuery.eq).toHaveBeenCalledWith("id", id);
    expect(mocks.briefQuery.eq).toHaveBeenCalledWith("engagement_id", id);
    expect(mocks.updatesQuery.eq).toHaveBeenCalledWith("engagement_id", id);
    expect(screen.getByText("buyer@example.com")).toBeVisible();
    expect(screen.getByText("Brief received")).toBeVisible();
  });
});
