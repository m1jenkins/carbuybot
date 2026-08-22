// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const adminQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };

  return {
    adminQuery,
    createServerClient: vi.fn(),
    from: vi.fn(),
    getUser: vi.fn(),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    redirect: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

import { requireAdmin } from "./admin";

describe("requireAdmin", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    mocks.adminQuery.select.mockReturnValue(mocks.adminQuery);
    mocks.adminQuery.eq.mockReturnValue(mocks.adminQuery);
    mocks.adminQuery.maybeSingle.mockResolvedValue({
      data: { role: "operator" },
      error: null,
    });
    mocks.from.mockReturnValue(mocks.adminQuery);
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          app_metadata: {},
          id: "f33054d1-ca4f-4ea5-b7ed-379efe27f46f",
          user_metadata: {},
        },
      },
      error: null,
    });
    mocks.createServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it("fails safely before creating a client when configuration is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    await expect(requireAdmin()).rejects.toThrow(
      "Admin access is not configured.",
    );
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("uses a fresh user check and the caller's active admin assignment", async () => {
    await expect(requireAdmin()).resolves.toEqual({
      id: "f33054d1-ca4f-4ea5-b7ed-379efe27f46f",
      role: "operator",
    });

    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("admin_users");
    expect(mocks.adminQuery.select).toHaveBeenCalledWith("role");
    expect(mocks.adminQuery.eq).toHaveBeenNthCalledWith(
      1,
      "user_id",
      "f33054d1-ca4f-4ea5-b7ed-379efe27f46f",
    );
    expect(mocks.adminQuery.eq).toHaveBeenNthCalledWith(2, "active", true);
  });

  it("redirects an unauthenticated request before any customer-data query", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("expired"),
    });

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in?next=%2Fadmin");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns a non-leaking not-found denial when no active row is visible", async () => {
    mocks.adminQuery.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("never authorizes from editable user metadata", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          app_metadata: {},
          id: "f33054d1-ca4f-4ea5-b7ed-379efe27f46f",
          user_metadata: { role: "admin" },
        },
      },
      error: null,
    });
    mocks.adminQuery.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("denies malformed or unexpected database roles", async () => {
    mocks.adminQuery.maybeSingle.mockResolvedValueOnce({
      data: { role: "owner" },
      error: null,
    });

    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
