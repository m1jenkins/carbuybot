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
    range: vi.fn(),
    select: vi.fn(),
  };

  return {
    briefQuery,
    createServerClient: vi.fn(),
    engagementQuery,
    from: vi.fn(),
    loadAdminEngagementPage: vi.fn(),
    loadWorkflowCounts: vi.fn(),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    queueQuery,
    redirect: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
    requireAdmin: vi.fn(),
    signOut: vi.fn(),
    updateEngagementStatus: vi.fn(),
    updatesQuery,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
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
vi.mock("@/lib/admin/engagement-queries", () => ({
  ADMIN_QUEUE_PAGE_SIZE: 25,
  loadAdminEngagementPage: mocks.loadAdminEngagementPage,
  loadWorkflowCounts: mocks.loadWorkflowCounts,
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

const counts = {
  awaiting_brief: 1_100,
  brief_submitted: 1_250,
  cancelled: 75,
  completed: 90,
  in_review: 800,
  negotiating: 300,
  offers_ready: 120,
  searching: 2_000,
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
    mocks.loadWorkflowCounts.mockResolvedValue({
      counts,
      error: null,
    });
    mocks.loadAdminEngagementPage.mockResolvedValue({
      count: 81,
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
    mocks.updatesQuery.order.mockReturnValue(mocks.updatesQuery);
    mocks.updatesQuery.range.mockResolvedValue({
      count: 45,
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
    render(
      await AdminPage({
        searchParams: Promise.resolve({
          page: "2",
          payment: "paid",
          q: "Buyer@Example.com",
          sort: "customer",
          status: "searching",
        }),
      }),
    );

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.createServerClient).toHaveBeenCalledOnce();
    expect(mocks.loadWorkflowCounts).toHaveBeenCalledOnce();
    expect(mocks.loadAdminEngagementPage).toHaveBeenCalledWith(
      expect.anything(),
      {
        emailPattern: "buyer@example.com",
        page: 2,
        payment: "paid",
        search: "buyer@example.com",
        searchId: null,
        sort: "customer",
        status: "searching",
      },
    );
    expect(screen.getByText("1,250")).toBeVisible();
    expect(screen.getByText("Showing 26–26 of 81 engagements.")).toBeVisible();
    expect(screen.getByRole("link", { name: /next page/i })).toHaveAttribute(
      "href",
      expect.stringContaining("page=3"),
    );
    expect(screen.getByRole("link", { name: /Genesis GV80/i })).toBeVisible();
  });

  it("canonicalizes a queue page beyond the final filtered page", async () => {
    mocks.loadAdminEngagementPage.mockResolvedValueOnce({
      count: 26,
      data: [],
      error: null,
    });

    await expect(
      AdminPage({
        searchParams: Promise.resolve({
          page: "99",
          payment: "paid",
          q: "Buyer@Example.com",
          sort: "customer",
          status: "searching",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin?status=searching&payment=paid&q=buyer%40example.com&sort=customer&page=2",
    );
  });

  it("loads an exact, bounded status-history page with older/newer controls", async () => {
    render(
      await EngagementPage({
        params: Promise.resolve({ id }),
        searchParams: Promise.resolve({ historyPage: "2" }),
      }),
    );

    expect(mocks.updatesQuery.select).toHaveBeenCalledWith(expect.any(String), {
      count: "exact",
    });
    expect(mocks.updatesQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(mocks.updatesQuery.order).toHaveBeenCalledWith("id", {
      ascending: false,
    });
    expect(mocks.updatesQuery.range).toHaveBeenCalledWith(20, 39);
    expect(screen.getByText("45 updates total")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /return to newer updates/i }),
    ).toHaveAttribute(
      "href",
      `/admin/engagements/${id}?historyPage=1#admin-history-title`,
    );
    expect(
      screen.getByRole("link", { name: /load older updates/i }),
    ).toHaveAttribute(
      "href",
      `/admin/engagements/${id}?historyPage=3#admin-history-title`,
    );
  });

  it("canonicalizes history pages beyond the final page", async () => {
    await expect(
      EngagementPage({
        params: Promise.resolve({ id }),
        searchParams: Promise.resolve({ historyPage: "99" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith(
      `/admin/engagements/${id}?historyPage=3#admin-history-title`,
    );
  });

  it("loads full detail and history through the authenticated RLS client", async () => {
    render(
      await EngagementPage({
        params: Promise.resolve({ id }),
        searchParams: Promise.resolve({}),
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
