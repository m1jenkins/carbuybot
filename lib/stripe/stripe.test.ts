import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertTestStripeKey } from "./client";
import {
  getAppUrl,
  getStripePriceIds,
  getStripeWebhookSecret,
} from "../env";
import {
  fulfillCheckoutSession,
  processEvent,
  type PersistStripeEvent,
  type PersistStripeExpiration,
  type PersistStripeRefund,
  type StripeEventInput,
} from "./fulfillment";
import { choosePrice, getPriceAmountCents } from "./pricing";

const paidSession = {
  id: "cs_test_checkout",
  amount_total: 34_900,
  client_reference_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
  currency: "usd",
  customer: "cus_test_buyer",
  customer_details: {
    email: " Buyer@Example.COM ",
  },
  customer_email: null,
  metadata: {
    engagement_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
    price_id: "price_intro_test",
  },
  livemode: false,
  mode: "payment",
  payment_intent: "pi_test_payment",
  payment_status: "paid",
} as unknown as Stripe.Checkout.Session;

const completedEvent = {
  id: "evt_test_completed",
  livemode: false,
  type: "checkout.session.completed",
  data: { object: paidSession },
} as Stripe.Event;

function createMemoryPersistence() {
  const eventIds = new Set<string>();
  const calls: StripeEventInput[] = [];

  const persist: PersistStripeEvent = async (input) => {
    calls.push(input);
    if (eventIds.has(input.eventId)) {
      return false;
    }

    eventIds.add(input.eventId);
    return true;
  };

  return { calls, persist };
}

describe("Stripe test-mode guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    "sk_live_example",
    "rk_live_example",
    "rkcs_live_example",
    "pk_live_example",
    "pk_test_example",
    "sk_sandbox_example",
    "rk_sandbox_example",
    "whsec_example",
  ])(
    "rejects live or non-secret test Stripe key %s",
    (key) => {
      expect(() => assertTestStripeKey(key)).toThrow(/test-mode/i);
    },
  );

  it.each(["sk_test_example", "rk_test_example", "rkcs_test_example"])(
    "accepts test Stripe key %s",
    (key) => {
      expect(assertTestStripeKey(key)).toBe(key);
    },
  );

  it("validates webhook, Price, and application configuration lazily", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("STRIPE_PRICE_INTRO_ID", "price_intro_test");
    vi.stubEnv("STRIPE_PRICE_STANDARD_ID", "price_standard_test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test/");

    expect(getStripeWebhookSecret()).toBe("whsec_test");
    expect(getStripePriceIds()).toEqual({
      intro: "price_intro_test",
      standard: "price_standard_test",
    });
    expect(getAppUrl()).toBe("https://example.test");
  });
});

describe("server-selected Stripe pricing", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_PRICE_INTRO_ID", "price_intro_test");
    vi.stubEnv("STRIPE_PRICE_STANDARD_ID", "price_standard_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the intro price for the first 100 paid engagements", () => {
    expect(choosePrice(99)).toEqual({
      label: "intro",
      priceId: "price_intro_test",
    });
    expect(getPriceAmountCents("intro")).toBe(34_900);
  });

  it("uses the standard price after the intro cohort", () => {
    expect(choosePrice(100)).toEqual({
      label: "standard",
      priceId: "price_standard_test",
    });
    expect(getPriceAmountCents("standard")).toBe(39_900);
  });
});

describe("Stripe event fulfillment", () => {
  it("normalizes and persists a paid completed Checkout Session", async () => {
    const memory = createMemoryPersistence();

    await expect(processEvent(completedEvent, memory.persist)).resolves.toBe(
      "processed",
    );
    expect(memory.calls).toEqual([
      {
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
      },
    ]);
  });

  it("returns success without side effects for a duplicate event", async () => {
    const memory = createMemoryPersistence();

    await expect(processEvent(completedEvent, memory.persist)).resolves.toBe(
      "processed",
    );
    await expect(processEvent(completedEvent, memory.persist)).resolves.toBe(
      "duplicate",
    );
  });

  it("records an unpaid completed event without granting fulfillment", async () => {
    const memory = createMemoryPersistence();
    const unpaidEvent = {
      ...completedEvent,
      id: "evt_test_unpaid",
      data: {
        object: {
          ...paidSession,
          payment_status: "unpaid",
        },
      },
    } as Stripe.Event;

    await expect(processEvent(unpaidEvent, memory.persist)).resolves.toBe(
      "processed",
    );
    expect(memory.calls[0]).toMatchObject({
      eventId: "evt_test_unpaid",
      fulfill: false,
    });
  });

  it("acknowledges subscription-mode completed events without fulfillment", async () => {
    const memory = createMemoryPersistence();
    const subscriptionEvent = {
      ...completedEvent,
      id: "evt_test_subscription",
      data: {
        object: {
          ...paidSession,
          customer: null,
          customer_details: null,
          metadata: {},
          mode: "subscription",
          payment_intent: null,
        },
      },
    } as Stripe.Event;

    await expect(processEvent(subscriptionEvent, memory.persist)).resolves.toBe(
      "processed",
    );
    await expect(processEvent(subscriptionEvent, memory.persist)).resolves.toBe(
      "duplicate",
    );
    expect(memory.calls[0]).toEqual({
      amountCents: null,
      checkoutSessionId: null,
      currency: null,
      customerEmail: null,
      customerId: null,
      engagementId: null,
      eventId: "evt_test_subscription",
      eventType: "checkout.session.completed",
      fulfill: false,
      paymentIntentId: null,
      priceId: null,
    });
  });

  it("rejects paid fulfillment without server-created engagement metadata", async () => {
    const memory = createMemoryPersistence();
    const invalidEvent = {
      ...completedEvent,
      data: {
        object: {
          ...paidSession,
          metadata: {},
        },
      },
    } as Stripe.Event;

    await expect(processEvent(invalidEvent, memory.persist)).rejects.toThrow(
      /engagement/i,
    );
    expect(memory.calls).toHaveLength(0);
  });

  it("rejects mismatched Checkout and metadata engagement references", async () => {
    const memory = createMemoryPersistence();
    const invalidEvent = {
      ...completedEvent,
      data: {
        object: {
          ...paidSession,
          client_reference_id: "83aca8da-9a4d-4b26-9414-7f444c39fc3d",
        },
      },
    } as Stripe.Event;

    await expect(processEvent(invalidEvent, memory.persist)).rejects.toThrow(
      /reference/i,
    );
    expect(memory.calls).toHaveLength(0);
  });

  it("rejects live-mode Checkout Sessions before persistence", async () => {
    const memory = createMemoryPersistence();
    const liveEvent = {
      ...completedEvent,
      data: {
        object: {
          ...paidSession,
          id: "cs_live_forbidden",
          livemode: true,
        },
      },
    } as Stripe.Event;

    await expect(processEvent(liveEvent, memory.persist)).rejects.toThrow(
      /test-mode/i,
    );
    expect(memory.calls).toHaveLength(0);
  });

  it("rejects live-mode webhook events before persistence", async () => {
    const memory = createMemoryPersistence();
    const liveEvent = {
      ...completedEvent,
      id: "evt_live_forbidden",
      livemode: true,
    } as Stripe.Event;

    await expect(processEvent(liveEvent, memory.persist)).rejects.toThrow(
      /test-mode/i,
    );
    expect(memory.calls).toHaveLength(0);
  });

  it("surfaces persistence failures so Stripe can retry", async () => {
    const persist: PersistStripeEvent = async () => {
      throw new Error("database transaction failed");
    };

    await expect(processEvent(completedEvent, persist)).rejects.toThrow(
      "database transaction failed",
    );
  });

  it("expires an abandoned pending Checkout reservation transactionally", async () => {
    const memory = createMemoryPersistence();
    const expire = vi.fn<PersistStripeExpiration>().mockResolvedValue(true);
    const expiredSession = {
      ...paidSession,
      id: "cs_test_expired",
      payment_status: "unpaid",
    } as Stripe.Checkout.Session;
    const event = {
      id: "evt_test_expired",
      livemode: false,
      type: "checkout.session.expired",
      data: { object: expiredSession },
    } as Stripe.Event;

    await expect(
      processEvent(event, memory.persist, expire),
    ).resolves.toBe("processed");
    expect(expire).toHaveBeenCalledWith({
      checkoutSessionId: "cs_test_expired",
      engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
      eventId: "evt_test_expired",
      priceId: "price_intro_test",
    });
    expect(memory.calls).toHaveLength(0);
  });

  it("reconciles only fully refunded test charges", async () => {
    const memory = createMemoryPersistence();
    const expire = vi.fn<PersistStripeExpiration>();
    const refund = vi.fn<PersistStripeRefund>().mockResolvedValue(true);
    const fullRefund = {
      id: "evt_test_refund",
      livemode: false,
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_test_refund",
          livemode: false,
          payment_intent: "pi_test_payment",
          refunded: true,
        },
      },
    } as Stripe.Event;

    await expect(
      processEvent(fullRefund, memory.persist, expire, refund),
    ).resolves.toBe("processed");
    expect(refund).toHaveBeenCalledWith({
      eventId: "evt_test_refund",
      paymentIntentId: "pi_test_payment",
    });

    const partialRefund = {
      ...fullRefund,
      id: "evt_test_partial_refund",
      data: {
        object: {
          ...(fullRefund.data.object as Stripe.Charge),
          refunded: false,
        },
      },
    } as Stripe.Event;
    await expect(
      processEvent(partialRefund, memory.persist, expire, refund),
    ).resolves.toBe("processed");
    expect(refund).toHaveBeenCalledOnce();
    expect(memory.calls.at(-1)).toMatchObject({
      eventId: "evt_test_partial_refund",
      fulfill: false,
    });
  });

  it("supports direct session fulfillment while keeping it idempotent", async () => {
    const memory = createMemoryPersistence();

    await expect(
      fulfillCheckoutSession(paidSession, undefined, memory.persist),
    ).resolves.toBe("processed");
    await expect(
      fulfillCheckoutSession(paidSession, undefined, memory.persist),
    ).resolves.toBe("duplicate");
    expect(memory.calls[0]?.eventId).toBe(
      "evt_session_cs_test_checkout",
    );
  });
});
