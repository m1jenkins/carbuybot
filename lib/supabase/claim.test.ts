import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getUser = vi.fn();
  const rpc = vi.fn();
  const createServerClient = vi.fn(async () => ({ auth: { getUser } }));
  const createAdminClient = vi.fn(() => ({ rpc }));

  return {
    createAdminClient,
    createServerClient,
    getUser,
    rpc,
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
    mocks.rpc.mockResolvedValue({ data: 2, error: null });
  });

  it("atomically claims paid, unowned rows for the verified normalized email", async () => {
    await expect(
      claimPaidEngagements(
        authenticatedUser.id,
        " buyer@example.com ",
      ),
    ).resolves.toBe(2);

    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "claim_paid_engagements",
      {
        p_user_id: authenticatedUser.id,
        p_verified_email: "buyer@example.com",
      },
    );
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

  it("surfaces a transactional claim failure", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error("claim transaction failed"),
    });

    await expect(
      claimPaidEngagements(authenticatedUser.id, "buyer@example.com"),
    ).rejects.toThrow("claim transaction failed");
  });
});
