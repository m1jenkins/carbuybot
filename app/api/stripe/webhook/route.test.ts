import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  processEvent: vi.fn(),
  getStripe: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: mocks.getStripe,
}));
vi.mock("@/lib/stripe/fulfillment", () => ({
  processEvent: mocks.processEvent,
}));

import { POST } from "./route";

const rawEvent =
  '{"id":"evt_test_completed","type":"checkout.session.completed"}';
const verifiedEvent = {
  id: "evt_test_completed",
  type: "checkout.session.completed",
};

function webhookRequest(signature = "t=123,v1=test-signature") {
  return new Request("https://carbuyerbots.test/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: rawEvent,
  });
}

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: mocks.constructEvent },
    });
    mocks.constructEvent.mockReturnValue(verifiedEvent);
    mocks.processEvent.mockResolvedValue("processed");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("verifies the signature against the unchanged raw request body", async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mocks.constructEvent).toHaveBeenCalledWith(
      rawEvent,
      "t=123,v1=test-signature",
      "whsec_test",
    );
    expect(mocks.processEvent).toHaveBeenCalledWith(verifiedEvent);
  });

  it("returns success for duplicate verified events", async () => {
    mocks.processEvent.mockResolvedValue("duplicate");

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
  });

  it("rejects a missing signature without processing the event", async () => {
    const request = new Request(
      "https://carbuyerbots.test/api/stripe/webhook",
      {
        method: "POST",
        body: rawEvent,
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.processEvent).not.toHaveBeenCalled();
  });

  it("rejects a signature verification failure", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    expect(mocks.processEvent).not.toHaveBeenCalled();
  });

  it("returns non-2xx when the database transaction fails", async () => {
    mocks.processEvent.mockRejectedValue(
      new Error("database transaction failed"),
    );

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Webhook processing failed.",
    });
  });
});
