// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { proxy } from "./proxy";

describe("Supabase auth proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user_1" } },
      error: null,
    });
    mocks.createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            setAll: (
              cookies: {
                name: string;
                value: string;
                options: { path: string };
              }[],
              headers: Record<string, string>,
            ) => void;
          };
        },
      ) => ({
        auth: {
          getClaims: async () => {
            options.cookies.setAll(
              [
                {
                  name: "sb-test-auth-token",
                  value: "refreshed",
                  options: { path: "/" },
                },
              ],
              { "Cache-Control": "private, no-store" },
            );
            return mocks.getClaims();
          },
        },
      }),
    );
  });

  it("refreshes auth with getClaims and propagates cookies and cache headers", async () => {
    const response = await proxy(
      new NextRequest("https://carbuyerbots.com/onboarding"),
    );

    expect(mocks.getClaims).toHaveBeenCalledOnce();
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an unauthenticated customer route to a safe sign-in URL", async () => {
    mocks.getClaims.mockResolvedValueOnce({
      data: { claims: null },
      error: new Error("invalid token"),
    });

    const response = await proxy(
      new NextRequest(
        "https://carbuyerbots.com/onboarding?from=payment",
      ),
    );
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe("https://carbuyerbots.com");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe(
      "/onboarding?from=payment",
    );
  });

  it("allows a reviewable setup state when public configuration is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const response = await proxy(
      new NextRequest("https://carbuyerbots.com/onboarding"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
});
