import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  countPaidEngagements,
  createPendingEngagement,
  persistStripeEvent,
} from "./repository";

describe("Stripe service-role repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts paid engagements for server-side cohort selection", async () => {
    const eq = vi.fn().mockResolvedValue({ count: 99, error: null });
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(countPaidEngagements()).resolves.toBe(99);
    expect(from).toHaveBeenCalledWith("engagements");
    expect(select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(eq).toHaveBeenCalledWith("payment_status", "paid");
  });

  it("inserts a pending engagement using only server-selected fields", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "a6204b70-c308-40e8-b87f-30843d48cb79" },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(
      createPendingEngagement({
        amountCents: 34_900,
        currency: "usd",
        customerEmail: "buyer@example.com",
        priceId: "price_intro_test",
      }),
    ).resolves.toEqual({
      id: "a6204b70-c308-40e8-b87f-30843d48cb79",
    });
    expect(insert).toHaveBeenCalledWith({
      amount_cents: 34_900,
      currency: "usd",
      customer_email: "buyer@example.com",
      payment_status: "pending",
      price_id: "price_intro_test",
      workflow_status: "awaiting_brief",
    });
  });

  it("surfaces database failures without leaking into client fields", async () => {
    const eq = vi.fn().mockResolvedValue({
      count: null,
      error: new Error("database unavailable"),
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq })),
      })),
    });

    await expect(countPaidEngagements()).rejects.toThrow(
      "database unavailable",
    );
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
});
