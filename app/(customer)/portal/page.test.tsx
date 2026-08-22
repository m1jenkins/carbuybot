import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const engagementQuery = {
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    then: vi.fn(),
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
    getUser: vi.fn(),
    redirect: vi.fn(),
    signOut: vi.fn(),
    updatesQuery,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

import PortalPage from "./page";

const engagement = {
  amount_cents: 34_900,
  created_at: "2026-08-20T12:00:00.000Z",
  currency: "usd",
  id: "a6204b70-c308-40e8-b87f-30843d48cb79",
  payment_status: "paid",
  stripe_checkout_session_id: "cs_test_customer_reference",
  stripe_payment_intent_id: "pi_test_customer_reference",
  workflow_status: "brief_submitted",
};
const completedEngagement = {
  ...engagement,
  created_at: "2026-08-22T12:00:00.000Z",
  id: "83aca8da-9a4d-4b26-9414-7f444c39fc3d",
  stripe_checkout_session_id: "cs_test_completed_reference",
  workflow_status: "completed",
};

const brief = {
  budget_cents: 6_000_000,
  city: "Austin",
  colors: ["Black"],
  condition: "either",
  deal_breakers: [],
  financing_preference: "undecided",
  has_trade_in: false,
  make: "Genesis",
  model: "GV80",
  notes: null,
  options: [],
  postal_code: "78701",
  search_radius_miles: 100,
  state: "TX",
  timeline: "within_30_days",
  trade_in_details: null,
  trim: null,
  year_max: 2025,
  year_min: 2025,
};

describe("PortalPage", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

    mocks.engagementQuery.select.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.eq.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.order.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.limit.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.maybeSingle.mockResolvedValue({
      data: engagement,
      error: null,
    });
    mocks.engagementQuery.then.mockImplementation((onFulfilled, onRejected) =>
      Promise.resolve({
        data: [completedEngagement, engagement],
        error: null,
      }).then(onFulfilled, onRejected),
    );

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
          created_at: "2026-08-22T15:00:00.000Z",
          customer_visible: true,
          id: "update-1",
          note: "We received your brief.",
          status: "brief_submitted",
          title: "Brief submitted",
        },
      ],
      error: null,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "engagements") return mocks.engagementQuery;
      if (table === "vehicle_briefs") return mocks.briefQuery;
      if (table === "status_updates") return mocks.updatesQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          email: "buyer@example.com",
          email_confirmed_at: "2026-08-22T00:00:00.000Z",
          id: "user-1",
        },
      },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.createServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser, signOut: mocks.signOut },
      from: mocks.from,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it("loads the owned portal record through the authenticated RLS client", async () => {
    render(
      await PortalPage({
        searchParams: Promise.resolve({ engagement: engagement.id }),
      }),
    );

    expect(mocks.createServerClient).toHaveBeenCalledTimes(1);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      "engagements",
      "vehicle_briefs",
      "status_updates",
    ]);
    expect(mocks.engagementQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.engagementQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(mocks.briefQuery.eq).toHaveBeenCalledWith(
      "engagement_id",
      engagement.id,
    );
    expect(mocks.updatesQuery.eq).toHaveBeenCalledWith(
      "engagement_id",
      engagement.id,
    );
    expect(mocks.updatesQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
    expect(
      screen.getByRole("heading", { level: 1, name: /brief submitted/i }),
    ).toBeVisible();
    expect(screen.getByText(/2025 Genesis GV80/i)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /brief submitted/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("renders a truthful state when no engagement is visible", async () => {
    mocks.engagementQuery.then.mockImplementationOnce(
      (onFulfilled, onRejected) =>
        Promise.resolve({ data: [], error: null }).then(
          onFulfilled,
          onRejected,
        ),
    );
    mocks.engagementQuery.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    render(
      await PortalPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /no active engagement/i }),
    ).toBeVisible();
    expect(
      screen.getByText(/no paid vehicle search is linked/i),
    ).toBeVisible();
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("renders setup guidance without creating a client when config is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    render(
      await PortalPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /customer access is not configured/i }),
    ).toBeVisible();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("defaults to an active engagement before a newer completed one", async () => {
    render(
      await PortalPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(mocks.briefQuery.eq).toHaveBeenCalledWith(
      "engagement_id",
      engagement.id,
    );
    expect(
      screen.getByRole("link", { name: /brief submitted/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("honors an owned selection and safely falls back from an unowned ID", async () => {
    const { unmount } = render(
      await PortalPage({
        searchParams: Promise.resolve({
          engagement: completedEngagement.id,
        }),
      }),
    );

    expect(mocks.briefQuery.eq).toHaveBeenLastCalledWith(
      "engagement_id",
      completedEngagement.id,
    );
    expect(
      screen.getByRole("link", { name: /search complete/i }),
    ).toHaveAttribute("aria-current", "page");

    unmount();
    render(
      await PortalPage({
        searchParams: Promise.resolve({
          engagement: "00000000-0000-4000-8000-999999999999",
        }),
      }),
    );
    expect(mocks.briefQuery.eq).toHaveBeenLastCalledWith(
      "engagement_id",
      engagement.id,
    );
    expect(
      screen.queryByText("00000000-0000-4000-8000-999999999999"),
    ).not.toBeInTheDocument();
  });
});
