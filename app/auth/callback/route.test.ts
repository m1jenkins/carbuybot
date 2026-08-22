// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query = {
    eq: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
    select: vi.fn(),
  };

  return {
    claimPaidEngagements: vi.fn(),
    createServerClient: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    from: vi.fn(),
    getUser: vi.fn(),
    query,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/supabase/claim", () => ({
  claimPaidEngagements: mocks.claimPaidEngagements,
}));

import { GET } from "./route";

describe("magic-link callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });
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
    mocks.claimPaidEngagements.mockResolvedValue(1);
    mocks.query.select.mockReturnValue(mocks.query);
    mocks.query.eq.mockReturnValue(mocks.query);
    mocks.query.is.mockReturnValue(mocks.query);
    mocks.query.limit.mockResolvedValue({
      data: [{ id: "eng_1" }],
      error: null,
    });
    mocks.from.mockReturnValue(mocks.query);
    mocks.createServerClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: mocks.exchangeCodeForSession,
        getUser: mocks.getUser,
      },
      from: mocks.from,
    });
  });

  it("exchanges the code, verifies the user, claims by exact email, and resumes onboarding", async () => {
    const response = await GET(
      new Request(
        "https://carbuyerbots.com/auth/callback?code=auth-code&next=%2Fonboarding",
      ),
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.claimPaidEngagements).toHaveBeenCalledWith(
      "user_1",
      "buyer@example.com",
    );
    expect(mocks.from).toHaveBeenCalledWith("engagements");
    expect(response.headers.get("location")).toBe(
      "https://carbuyerbots.com/onboarding",
    );
  });

  it("routes a customer with no incomplete paid brief to the portal", async () => {
    mocks.query.limit.mockResolvedValueOnce({ data: [], error: null });

    const response = await GET(
      new Request(
        "https://carbuyerbots.com/auth/callback?code=auth-code&next=%2Fonboarding",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://carbuyerbots.com/portal",
    );
  });

  it("rejects an unverified identity without attempting a claim", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user_1",
          email: "buyer@example.com",
          email_confirmed_at: null,
        },
      },
      error: null,
    });

    const response = await GET(
      new Request("https://carbuyerbots.com/auth/callback?code=auth-code"),
    );

    expect(mocks.claimPaidEngagements).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toMatch(
      /^https:\/\/carbuyerbots\.com\/sign-in\?/,
    );
    expect(response.headers.get("location")).toContain("error=auth");
  });

  it("does not reflect an external destination into the retry redirect", async () => {
    const response = await GET(
      new Request(
        "https://carbuyerbots.com/auth/callback?next=https%3A%2F%2Fevil.example%2Fsteal",
      ),
    );
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe("https://carbuyerbots.com");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/onboarding");
    expect(location.href).not.toContain("evil.example");
  });

  it("renders a safe setup redirect when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const response = await GET(
      new Request("https://carbuyerbots.com/auth/callback?code=auth-code"),
    );

    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://carbuyerbots.com/sign-in?error=setup&next=%2Fonboarding",
    );
  });
});
