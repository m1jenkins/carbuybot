import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const engagementQuery = {
    eq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  };
  const draftQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };
  const briefQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };

  return {
    briefQuery,
    createServerClient: vi.fn(),
    draftQuery,
    engagementQuery,
    from: vi.fn(),
    getUser: vi.fn(),
    intakeProps: vi.fn(),
    redirect: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("@/components/onboarding/intake-thread", () => ({
  IntakeThread: (props: unknown) => {
    mocks.intakeProps(props);
    return <div data-testid="intake-thread" />;
  },
}));

import OnboardingPage from "./page";

const finalizedBrief = {
  budget_cents: 6_000_000,
  city: "Austin",
  colors: ["Black"],
  condition: "either",
  consent: true,
  deal_breakers: ["No accident history"],
  financing_preference: "undecided",
  has_trade_in: false,
  make: "Genesis",
  model: "GV80",
  notes: null,
  options: ["Advanced package"],
  postal_code: "78701",
  search_radius_miles: 100,
  state: "TX",
  timeline: "within_30_days",
  trade_in_details: null,
  trim: null,
  year_max: 2026,
  year_min: 2024,
};

describe("OnboardingPage brief revision", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

    mocks.engagementQuery.select.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.eq.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.in.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.order.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.limit.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "a6204b70-c308-40e8-b87f-30843d48cb79",
        workflow_status: "brief_submitted",
      },
      error: null,
    });

    mocks.draftQuery.select.mockReturnValue(mocks.draftQuery);
    mocks.draftQuery.eq.mockReturnValue(mocks.draftQuery);
    mocks.draftQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mocks.briefQuery.select.mockReturnValue(mocks.briefQuery);
    mocks.briefQuery.eq.mockReturnValue(mocks.briefQuery);
    mocks.briefQuery.maybeSingle.mockResolvedValue({
      data: finalizedBrief,
      error: null,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "engagements") return mocks.engagementQuery;
      if (table === "brief_drafts") return mocks.draftQuery;
      if (table === "vehicle_briefs") return mocks.briefQuery;
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
    mocks.createServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("maps a submitted brief into the conversational thread for revision", async () => {
    render(await OnboardingPage());

    expect(mocks.engagementQuery.in).toHaveBeenCalledWith("workflow_status", [
      "awaiting_brief",
      "brief_submitted",
    ]);
    expect(mocks.intakeProps).toHaveBeenCalledWith({
      engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
      initialDraft: {
        budgetCents: 6_000_000,
        city: "Austin",
        colors: ["Black"],
        condition: "either",
        consent: true,
        dealBreakers: ["No accident history"],
        financingPreference: "undecided",
        hasTradeIn: false,
        make: "Genesis",
        model: "GV80",
        notes: null,
        options: ["Advanced package"],
        postalCode: "78701",
        searchRadiusMiles: 100,
        state: "TX",
        timeline: "within_30_days",
        tradeInDetails: null,
        trim: null,
        yearMax: 2026,
        yearMin: 2024,
      },
      initialQuestionId: "condition",
      revisionMode: true,
    });
    expect(screen.getByTestId("intake-thread")).toBeVisible();
  });

  it("prefers a retained revision draft over the finalized brief", async () => {
    mocks.draftQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        answers: { ...finalizedBrief, make: "Toyota" },
        current_question_id: "model",
      },
      error: null,
    });

    render(await OnboardingPage());

    expect(mocks.intakeProps).toHaveBeenCalledWith(
      expect.objectContaining({
        initialDraft: expect.objectContaining({ make: "Toyota" }),
        initialQuestionId: "model",
        revisionMode: true,
      }),
    );
  });
});
