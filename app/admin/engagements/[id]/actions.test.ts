// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const engagementQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };

  return {
    createServerClient: vi.fn(),
    engagementQuery,
    from: vi.fn(),
    revalidatePath: vi.fn(),
    requireAdmin: vi.fn(),
    rpc: vi.fn(),
  };
});

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { updateEngagementStatus } from "./actions";

const validInput = {
  engagementId: "a6204b70-c308-40e8-b87f-30843d48cb79",
  nextStatus: "in_review" as const,
  note: "We are reviewing your vehicle brief before the search begins.",
  title: "Brief review started",
};

describe("updateEngagementStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.engagementQuery.select.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.eq.mockReturnValue(mocks.engagementQuery);
    mocks.engagementQuery.maybeSingle.mockResolvedValue({
      data: { workflow_status: "brief_submitted" },
      error: null,
    });
    mocks.from.mockReturnValue(mocks.engagementQuery);
    mocks.requireAdmin.mockResolvedValue({
      id: "admin-1",
      role: "admin",
    });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.createServerClient.mockResolvedValue({
      from: mocks.from,
      rpc: mocks.rpc,
    });
  });

  it("validates required customer-visible copy before authorization or mutation", async () => {
    await expect(
      updateEngagementStatus({
        ...validInput,
        note: " ",
        title: "",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Add a title and a plain-language customer update.",
    });
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("checks the current RLS-visible state and invokes one authenticated RPC", async () => {
    await expect(updateEngagementStatus(validInput)).resolves.toEqual({
      ok: true,
    });

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.createServerClient).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("engagements");
    expect(mocks.engagementQuery.select).toHaveBeenCalledWith(
      "workflow_status",
    );
    expect(mocks.engagementQuery.eq).toHaveBeenCalledWith(
      "id",
      validInput.engagementId,
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("update_engagement_status", {
      p_engagement_id: validInput.engagementId,
      p_next_status: "in_review",
      p_note: validInput.note,
      p_title: validInput.title,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/admin/engagements/${validInput.engagementId}`,
    );
  });

  it("does not call the RPC for a repeated or impossible transition", async () => {
    mocks.engagementQuery.maybeSingle.mockResolvedValueOnce({
      data: { workflow_status: "in_review" },
      error: null,
    });

    await expect(updateEngagementStatus(validInput)).resolves.toEqual({
      ok: false,
      error: "That workflow change is not allowed from the current status.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a non-leaking error when the row is missing or the RPC rejects", async () => {
    mocks.engagementQuery.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: new Error("RLS denied"),
    });

    await expect(updateEngagementStatus(validInput)).resolves.toEqual({
      ok: false,
      error: "We could not update that engagement. Refresh and try again.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.engagementQuery.maybeSingle.mockResolvedValueOnce({
      data: { workflow_status: "brief_submitted" },
      error: null,
    });
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error("transition raced"),
    });
    await expect(updateEngagementStatus(validInput)).resolves.toEqual({
      ok: false,
      error:
        "The workflow changed before this update was saved. Refresh and try again.",
    });
  });
});
