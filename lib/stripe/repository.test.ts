import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  attachCheckoutSession,
  failCheckoutReservation,
  persistStripeEvent,
  persistStripeExpiration,
  persistStripeRefund,
  reserveCheckoutEngagement,
} from "./repository";

describe("Stripe service-role repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reserves pricing and a pending engagement in one database call", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          amount_cents: 34_900,
          currency: "usd",
          id: "a6204b70-c308-40e8-b87f-30843d48cb79",
          intro_slot: 1,
          price_id: "price_intro_test",
        },
      ],
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({ rpc });

    await expect(
      reserveCheckoutEngagement({
        customerEmail: "buyer@example.com",
        introPriceId: "price_intro_test",
        standardPriceId: "price_standard_test",
      }),
    ).resolves.toEqual({
      amountCents: 34_900,
      currency: "usd",
      id: "a6204b70-c308-40e8-b87f-30843d48cb79",
      introSlot: 1,
      priceId: "price_intro_test",
    });
    expect(rpc).toHaveBeenCalledWith("reserve_checkout_engagement", {
      p_customer_email: "buyer@example.com",
      p_intro_price_id: "price_intro_test",
      p_standard_price_id: "price_standard_test",
    });
  });

  it("surfaces database failures without leaking into client fields", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("database unavailable"),
    });
    mocks.createAdminClient.mockReturnValue({ rpc });

    await expect(
      reserveCheckoutEngagement({
        customerEmail: "buyer@example.com",
        introPriceId: "price_intro_test",
        standardPriceId: "price_standard_test",
      }),
    ).rejects.toThrow("database unavailable");
  });

  it("attaches a Checkout Session through an idempotent service-role RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    await expect(
      attachCheckoutSession({
        checkoutSessionId: "cs_test_checkout",
        engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
      }),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("attach_checkout_session", {
      p_checkout_session_id: "cs_test_checkout",
      p_engagement_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
    });
  });

  it("marks a definitively failed unattached reservation through a narrow RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    await expect(
      failCheckoutReservation("a6204b70-c308-40e8-b87f-30843d48cb79"),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("fail_checkout_reservation", {
      p_engagement_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
    });
  });

  it("maps fulfillment into one typed database RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    await expect(
      persistStripeEvent({
        amountCents: 34_900,
        checkoutSessionId: "cs_test_checkout",
        currency: "usd",
        customerEmail: "buyer@example.com",
        customerId: "cus_test_buyer",
        engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
        eventId: "evt_test_completed",
        eventType: "checkout.session.completed",
        fulfill: true,
        paymentIntentId: "pi_test_payment",
        priceId: "price_intro_test",
      }),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("fulfill_stripe_event", {
      p_amount_cents: 34_900,
      p_checkout_session_id: "cs_test_checkout",
      p_currency: "usd",
      p_customer_email: "buyer@example.com",
      p_customer_id: "cus_test_buyer",
      p_engagement_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
      p_event_id: "evt_test_completed",
      p_event_type: "checkout.session.completed",
      p_fulfill: true,
      p_payment_intent_id: "pi_test_payment",
      p_price_id: "price_intro_test",
    });
  });

  it("returns the transaction's duplicate result without a second write", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    await expect(
      persistStripeEvent({
        amountCents: null,
        checkoutSessionId: null,
        currency: null,
        customerEmail: null,
        customerId: null,
        engagementId: null,
        eventId: "evt_test_duplicate",
        eventType: "customer.created",
        fulfill: false,
        paymentIntentId: null,
        priceId: null,
      }),
    ).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("maps expiration and full-refund events to dedicated transactional RPCs", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    await expect(
      persistStripeExpiration({
        checkoutSessionId: "cs_test_expired",
        engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
        eventId: "evt_test_expired",
        priceId: "price_intro_test",
      }),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(1, "expire_stripe_checkout", {
      p_checkout_session_id: "cs_test_expired",
      p_engagement_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
      p_event_id: "evt_test_expired",
      p_price_id: "price_intro_test",
    });

    await expect(
      persistStripeRefund({
        eventId: "evt_test_refund",
        paymentIntentId: "pi_test_payment",
      }),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(2, "refund_stripe_payment", {
      p_event_id: "evt_test_refund",
      p_payment_intent_id: "pi_test_payment",
    });
  });
});
