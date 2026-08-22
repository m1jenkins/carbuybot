import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getUser = vi.fn();
  const upsert = vi.fn();
  const select = vi.fn();
  const is = vi.fn(() => ({ select }));
  const paymentStatusEq = vi.fn(() => ({ is }));
  const customerEmailEq = vi.fn(() => ({ eq: paymentStatusEq }));
  const update = vi.fn(() => ({ eq: customerEmailEq }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return { upsert };
    }

    return { update };
  });
  const createServerClient = vi.fn(async () => ({ auth: { getUser } }));
  const createAdminClient = vi.fn(() => ({ from }));

  return {
    createAdminClient,
    createServerClient,
    customerEmailEq,
    from,
    getUser,
    is,
    paymentStatusEq,
    select,
    update,
    upsert,
  };
});

vi.mock("./server", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("./admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { claimPaidEngagements } from "./claim";

const authenticatedUser = {
  id: "0c26ec80-eafe-4986-a427-724474dfa29d",
  email: " Buyer@Example.COM ",
  email_confirmed_at: "2026-08-22T07:00:00.000Z",
};

describe("claimPaidEngagements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: authenticatedUser },
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.select.mockResolvedValue({
      data: [{ id: "engagement-1" }, { id: "engagement-2" }],
      error: null,
    });
  });

  it("claims only paid, unowned rows matching the verified normalized email", async () => {
    await expect(
      claimPaidEngagements(
        authenticatedUser.id,
        " buyer@example.com ",
      ),
    ).resolves.toBe(2);

    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        id: authenticatedUser.id,
        email: "buyer@example.com",
      },
      { onConflict: "id" },
    );
    expect(mocks.update).toHaveBeenCalledWith({
      user_id: authenticatedUser.id,
    });
    expect(mocks.customerEmailEq).toHaveBeenCalledWith(
      "customer_email",
      "buyer@example.com",
    );
    expect(mocks.paymentStatusEq).toHaveBeenCalledWith(
      "payment_status",
      "paid",
    );
    expect(mocks.is).toHaveBeenCalledWith("user_id", null);
    expect(mocks.select).toHaveBeenCalledWith("id");
  });

  it("does not create a privileged client before server authentication succeeds", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid session"),
    });

    await expect(
      claimPaidEngagements(authenticatedUser.id, "buyer@example.com"),
    ).rejects.toThrow(/authenticated/i);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a caller-supplied identity that differs from the authenticated user", async () => {
    await expect(
      claimPaidEngagements(
        "53241667-47a6-41cd-a434-4a913abec6cf",
        "attacker@example.com",
      ),
    ).rejects.toThrow(/does not match/i);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an auth user whose email is not verified", async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: { ...authenticatedUser, email_confirmed_at: null },
      },
      error: null,
    });

    await expect(
      claimPaidEngagements(authenticatedUser.id, "buyer@example.com"),
    ).rejects.toThrow(/verified email/i);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("stops if the profile cannot be persisted", async () => {
    mocks.upsert.mockResolvedValue({
      error: new Error("profile write failed"),
    });

    await expect(
      claimPaidEngagements(authenticatedUser.id, "buyer@example.com"),
    ).rejects.toThrow("profile write failed");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
