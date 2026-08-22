import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const attachCheckoutSession = vi.fn();
  const reserveCheckoutEngagement = vi.fn();
  const failCheckoutReservation = vi.fn();
  const createSession = vi.fn();

  return {
    attachCheckoutSession,
    reserveCheckoutEngagement,
    failCheckoutReservation,
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
  attachCheckoutSession: mocks.attachCheckoutSession,
  failCheckoutReservation: mocks.failCheckoutReservation,
  reserveCheckoutEngagement: mocks.reserveCheckoutEngagement,
}));

import { POST } from "./route";

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://carbuyerbots.test/");
    vi.stubEnv("STRIPE_PRICE_INTRO_ID", "price_intro_test");
    vi.stubEnv("STRIPE_PRICE_STANDARD_ID", "price_standard_test");
    mocks.reserveCheckoutEngagement.mockResolvedValue({
      amountCents: 34_900,
      currency: "usd",
      id: "a6204b70-c308-40e8-b87f-30843d48cb79",
      introSlot: 100,
      priceId: "price_intro_test",
    });
    mocks.attachCheckoutSession.mockResolvedValue(true);
    mocks.failCheckoutReservation.mockResolvedValue(true);
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
    expect(mocks.reserveCheckoutEngagement).toHaveBeenCalledWith({
      customerEmail: "buyer@example.com",
      introPriceId: "price_intro_test",
      standardPriceId: "price_standard_test",
    });
    expect(mocks.createSession).toHaveBeenCalledWith(
      {
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
      },
      {
        idempotencyKey:
          "checkout-engagement-a6204b70-c308-40e8-b87f-30843d48cb79",
      },
    );
    expect(mocks.attachCheckoutSession).toHaveBeenCalledWith({
      checkoutSessionId: "cs_test_checkout",
      engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
    });
    expect(
      mocks.createSession.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.attachCheckoutSession.mock.invocationCallOrder[0]!);
    expect(mocks.failCheckoutReservation).not.toHaveBeenCalled();
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
    expect(mocks.reserveCheckoutEngagement).not.toHaveBeenCalled();
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
    expect(mocks.failCheckoutReservation).not.toHaveBeenCalled();
  });

  it.each([
    "StripeInvalidRequestError",
    "StripeAuthenticationError",
    "StripePermissionError",
  ])("releases a definitive %s creation failure", async (type) => {
    mocks.createSession.mockRejectedValueOnce({
      message: "Definitive provider rejection",
      type,
    });

    const response = await POST(
      new Request("https://carbuyerbots.test/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "buyer@example.com" }),
      }),
    );

    expect(response.status).toBe(500);
    expect(mocks.failCheckoutReservation).toHaveBeenCalledWith(
      "a6204b70-c308-40e8-b87f-30843d48cb79",
    );
    expect(mocks.attachCheckoutSession).not.toHaveBeenCalled();
  });

  it("retains an ambiguous provider failure and retries with the same engagement key", async () => {
    mocks.createSession.mockRejectedValueOnce({
      message: "Connection timed out",
      type: "StripeConnectionError",
    });

    const firstResponse = await POST(
      new Request("https://carbuyerbots.test/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "buyer@example.com" }),
      }),
    );
    const secondResponse = await POST(
      new Request("https://carbuyerbots.test/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "buyer@example.com" }),
      }),
    );

    expect(firstResponse.status).toBe(500);
    expect(secondResponse.status).toBe(200);
    expect(mocks.failCheckoutReservation).not.toHaveBeenCalled();
    expect(mocks.reserveCheckoutEngagement).toHaveBeenCalledTimes(2);
    expect(mocks.createSession).toHaveBeenCalledTimes(2);
    expect(mocks.createSession.mock.calls[0]?.[1]).toEqual(
      mocks.createSession.mock.calls[1]?.[1],
    );
    expect(mocks.attachCheckoutSession).toHaveBeenCalledOnce();
  });

  it("idempotently retries attaching the recovered Checkout Session", async () => {
    mocks.attachCheckoutSession
      .mockRejectedValueOnce(new Error("ambiguous database response"))
      .mockResolvedValueOnce(true);

    const firstResponse = await POST(
      new Request("https://carbuyerbots.test/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "buyer@example.com" }),
      }),
    );
    const secondResponse = await POST(
      new Request("https://carbuyerbots.test/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "buyer@example.com" }),
      }),
    );

    expect(firstResponse.status).toBe(500);
    expect(secondResponse.status).toBe(200);
    expect(mocks.createSession.mock.calls[0]?.[1]).toEqual(
      mocks.createSession.mock.calls[1]?.[1],
    );
    expect(mocks.attachCheckoutSession).toHaveBeenNthCalledWith(1, {
      checkoutSessionId: "cs_test_checkout",
      engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
    });
    expect(mocks.attachCheckoutSession).toHaveBeenNthCalledWith(2, {
      checkoutSessionId: "cs_test_checkout",
      engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
    });
    expect(mocks.failCheckoutReservation).not.toHaveBeenCalled();
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
    expect(mocks.reserveCheckoutEngagement).not.toHaveBeenCalled();
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
    expect(mocks.reserveCheckoutEngagement).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
