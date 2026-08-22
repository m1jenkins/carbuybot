// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const draftQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };

  return {
    adminRpc: vi.fn(),
    createAdminClient: vi.fn(),
    createServerClient: vi.fn(),
    draftQuery,
    from: vi.fn(),
    getUser: vi.fn(),
    select: vi.fn(),
    upsert: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { saveAnswer, submitBrief } from "./actions";

const completeAnswers = {
  condition: "either",
  make: "Genesis",
  model: "GV80",
  yearMin: 2024,
  yearMax: 2026,
  trim: null,
  colors: ["Black"],
  options: ["Advanced package"],
  dealBreakers: [],
  budgetCents: 6000000,
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  searchRadiusMiles: 100,
  timeline: "within_30_days",
  hasTradeIn: false,
  tradeInDetails: "2019 sedan, 40,000 miles",
  financingPreference: "undecided",
  notes: null,
  consent: true,
};

describe("onboarding server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user_1",
          email: "buyer@example.com",
          email_confirmed_at: "2026-08-22T00:00:00.000Z",
        },
      },
      error: null,
    });
    mocks.draftQuery.eq.mockReturnValue(mocks.draftQuery);
    mocks.draftQuery.maybeSingle.mockResolvedValue({
      data: { answers: { condition: "new" } },
      error: null,
    });
    mocks.select.mockReturnValue(mocks.draftQuery);
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({
      select: mocks.select,
      upsert: mocks.upsert,
    });
    mocks.createServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
    mocks.adminRpc.mockResolvedValue({ data: true, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.adminRpc });
  });

  it("requires a fresh authenticated user before saving", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("expired"),
    });

    await expect(
      saveAnswer({
        engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
        questionId: "condition",
        value: "new",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Sign in again before saving your answer.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("validates and normalizes one answer before persisting the merged draft", async () => {
    const result = await saveAnswer({
      engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
      questionId: "make",
      value: "  Toyota  ",
    });

    expect(result).toEqual({ ok: true, value: "Toyota" });
    expect(mocks.from).toHaveBeenCalledWith("brief_drafts");
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        engagement_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
        answers: { condition: "new", make: "Toyota" },
        current_question_id: "model",
        updated_at: expect.any(String),
      },
      { onConflict: "engagement_id" },
    );
  });

  it("rejects an invalid answer before touching the draft", async () => {
    await expect(
      saveAnswer({
        engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
        questionId: "postalCode",
        value: "12",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Enter a valid U.S. ZIP code.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("validates the complete persisted draft and finalizes as service role", async () => {
    mocks.draftQuery.maybeSingle.mockResolvedValueOnce({
      data: { answers: completeAnswers },
      error: null,
    });

    await expect(
      submitBrief({
        engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
      }),
    ).resolves.toEqual({ ok: true });

    expect(mocks.adminRpc).toHaveBeenCalledWith("finalize_vehicle_brief", {
      p_brief: {
        budget_cents: 6000000,
        city: "Austin",
        colors: ["Black"],
        condition: "either",
        consent: true,
        deal_breakers: [],
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
      },
      p_engagement_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
      p_user_id: "user_1",
    });
  });

  it("does not invoke finalization for an incomplete draft", async () => {
    mocks.draftQuery.maybeSingle.mockResolvedValueOnce({
      data: { answers: { condition: "new" } },
      error: null,
    });

    const result = await submitBrief({
      engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
    });

    expect(result).toEqual({
      ok: false,
      error: "Your brief is incomplete. Review the unanswered questions.",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
