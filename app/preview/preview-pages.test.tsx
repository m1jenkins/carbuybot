import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import PreviewAdminDetailPage from "./admin/engagements/[id]/page";
import PreviewAdminPage from "./admin/page";
import { metadata } from "./layout";
import PreviewOnboardingPage from "./onboarding/page";
import PreviewPortalPage from "./portal/page";

const fixtureId = "a6204b70-c308-40e8-b87f-30843d48cb79";

describe("non-production review fixtures", () => {
  const originalDemoMode = process.env.APP_DEMO_MODE;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_DEMO_MODE = "true";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    cleanup();
    process.env.APP_DEMO_MODE = originalDemoMode;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("404s every preview route in production even when demo mode is set", async () => {
    process.env.NODE_ENV = "production";

    const routes = [
      () => PreviewOnboardingPage(),
      () => PreviewPortalPage(),
      () => PreviewAdminPage(),
      () =>
        PreviewAdminDetailPage({
          params: Promise.resolve({ id: fixtureId }),
        }),
    ];

    for (const route of routes) {
      await expect(Promise.resolve().then(route)).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
    }
    expect(mocks.notFound).toHaveBeenCalledTimes(routes.length);
  });

  it("404s preview routes when the explicit local review flag is absent", async () => {
    delete process.env.APP_DEMO_MODE;

    await expect(
      Promise.resolve().then(() => PreviewPortalPage()),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders a local-only conversational intake fixture", () => {
    render(PreviewOnboardingPage());

    expect(screen.getByText(/local review fixture/i)).toBeVisible();
    expect(
      screen.getByText(
        /are you looking for a new car, a used car, or either/i,
      ),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "New" }));

    expect(
      screen.getByText("New", { selector: "[data-message=answer]" }),
    ).toBeVisible();
    expect(
      screen.getByText(/which make are you after/i, {
        selector: "[data-message=prompt]",
      }),
    ).toBeVisible();
    expect(screen.getByText(/never saved/i)).toBeVisible();
  });

  it("renders customer portal and admin overview/detail fixtures", async () => {
    const { rerender } = render(PreviewPortalPage());
    expect(
      screen.getByRole("heading", { name: /brief in review/i }),
    ).toBeVisible();
    expect(screen.getByText(/local review fixture/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeDisabled();

    rerender(PreviewAdminPage());
    expect(
      screen.getByRole("heading", { name: /engagement review/i }),
    ).toBeVisible();
    expect(
      screen
        .getAllByRole("link", { name: /genesis gv80/i })
        .map((link) => link.getAttribute("href")),
    ).toContain(
      `/preview/admin/engagements/${fixtureId}`,
    );

    rerender(
      await PreviewAdminDetailPage({
        params: Promise.resolve({ id: fixtureId }),
      }),
    );
    expect(screen.getByText("reviewer@example.com")).toBeVisible();
    expect(
      screen.getByText(/workflow updates are disabled in this local review fixture/i),
    ).toBeVisible();
  });

  it("marks every preview route noindex and nofollow", () => {
    expect(metadata.robots).toMatchObject({
      follow: false,
      index: false,
    });
  });
});
