import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const countPaidEngagements = vi.fn();
  const createPendingEngagement = vi.fn();
  const createSession = vi.fn();

  return {
    countPaidEngagements,
    createPendingEngagement,
    createSession,
    getStripe: vi.fn(() => ({
      checkout: {
        sessions: {
          create: createSession,
        },
      },
    })),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: mocks.getStripe,
}));
vi.mock("@/lib/stripe/repository", () => ({
  countPaidEngagements: mocks.countPaidEngagements,
  createPendingEngagement: mocks.createPendingEngagement,
}));

import { POST } from "./route";

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://carbuyerbots.test/");
    vi.stubEnv("STRIPE_PRICE_INTRO_ID", "price_intro_test");
    vi.stubEnv("STRIPE_PRICE_STANDARD_ID", "price_standard_test");
    mocks.countPaidEngagements.mockResolvedValue(99);
    mocks.createPendingEngagement.mockResolvedValue({
      id: "a6204b70-c308-40e8-b87f-30843d48cb79",
    });
    mocks.createSession.mockResolvedValue({
      id: "cs_test_checkout",
      url: "https://checkout.stripe.com/c/pay/cs_test_checkout",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("creates a one-time hosted Checkout Session from server pricing", async () => {
    const response = await POST(
      new Request("https://carbuyerbots.test/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: " Buyer@Example.COM " }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test_checkout",
    });
    expect(mocks.countPaidEngagements).toHaveBeenCalledOnce();
    expect(mocks.createPendingEngagement).toHaveBeenCalledWith({
      amountCents: 34_900,
      currency: "usd",
      customerEmail: "buyer@example.com",
      priceId: "price_intro_test",
    });
    expect(mocks.createSession).toHaveBeenCalledWith({
      mode: "payment",
      customer_email: "buyer@example.com",
      customer_creation: "always",
      line_items: [{ price: "price_intro_test", quantity: 1 }],
      success_url:
        "https://carbuyerbots.test/checkout/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://carbuyerbots.test/checkout/cancel",
      client_reference_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
      metadata: {
        engagement_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
        price_id: "price_intro_test",
      },
    });
  });

  it("rejects invalid email before any privileged operation", async () => {
    const response = await POST(
      new Request("https://carbuyerbots.test/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid email address.",
    });
    expect(mocks.countPaidEngagements).not.toHaveBeenCalled();
    expect(mocks.createPendingEngagement).not.toHaveBeenCalled();
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("does not expose provider errors", async () => {
    mocks.createSession.mockRejectedValue(
      new Error("secret provider failure with account details"),
    );

    const response = await POST(
      new Request("https://carbuyerbots.test/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "buyer@example.com" }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to start checkout. Please try again.",
    });
  });

  it("checks server configuration before creating a pending row", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    const response = await POST(
      new Request("https://carbuyerbots.test/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "buyer@example.com" }),
      }),
    );

    expect(response.status).toBe(500);
    expect(mocks.countPaidEngagements).not.toHaveBeenCalled();
    expect(mocks.createPendingEngagement).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("validates Stripe Price configuration before the paid-count query", async () => {
    vi.stubEnv("STRIPE_PRICE_INTRO_ID", "");

    const response = await POST(
      new Request("https://carbuyerbots.test/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "buyer@example.com" }),
      }),
    );

    expect(response.status).toBe(500);
    expect(mocks.countPaidEngagements).not.toHaveBeenCalled();
    expect(mocks.createPendingEngagement).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
