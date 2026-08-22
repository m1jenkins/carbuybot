import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("404s every preview route in production even when demo mode is set", async () => {
    vi.stubEnv("NODE_ENV", "production");

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
    vi.stubEnv("APP_DEMO_MODE", "");

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
    const { rerender } = render(await PreviewPortalPage());
    expect(
      screen.getByRole("heading", { name: /brief in review/i }),
    ).toBeVisible();
    expect(screen.getByText(/local review fixture/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeDisabled();

    rerender(await PreviewAdminPage());
    expect(
      screen.getByRole("link", { name: /carbuyerbots admin queue/i }),
    ).toHaveAttribute("href", "/preview/admin");
    expect(screen.getByText("Admin console")).toBeVisible();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeDisabled();
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
      screen.getByRole("link", { name: /carbuyerbots admin queue/i }),
    ).toHaveAttribute("href", "/preview/admin");
    expect(
      screen.getByText(/workflow updates are disabled in this local review fixture/i),
    ).toBeVisible();
  });

  it("selects a portal fixture from a validated engagement search parameter", async () => {
    render(
      await PreviewPortalPage({
        searchParams: Promise.resolve({
          engagement: "83aca8da-9a4d-4b26-9414-7f444c39fc3d",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /search complete/i }),
    ).toBeVisible();
    const switcher = screen.getByRole("navigation", {
      name: /your engagements/i,
    });
    expect(
      within(switcher).getByRole("link", { name: /search complete/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("applies admin fixture search, filters, and sorting from safe search parameters", async () => {
    const { rerender } = render(
      await PreviewAdminPage({
        searchParams: Promise.resolve({
          payment: "paid",
          q: "completed-review@example.com",
          sort: "customer",
          status: "completed",
        }),
      }),
    );

    expect(screen.getByText("completed-review@example.com")).toBeVisible();
    expect(screen.queryByText("reviewer@example.com")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/search engagements/i)).toHaveValue(
      "completed-review@example.com",
    );
    expect(screen.getByLabelText(/filter by workflow/i)).toHaveValue(
      "completed",
    );
    expect(screen.getByLabelText(/filter by payment/i)).toHaveValue("paid");
    expect(screen.getByLabelText(/sort engagements/i)).toHaveValue("customer");
    expect(screen.getByText("Showing 1–1 of 1 engagements.")).toBeVisible();

    rerender(
      await PreviewAdminPage({
        searchParams: Promise.resolve({ sort: "customer" }),
      }),
    );
    const rows = within(
      screen.getByRole("table", { name: /engagement review queue/i }),
    ).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("completed-review@example.com");
    expect(rows[2]).toHaveTextContent("reviewer@example.com");
  });

  it("marks every preview route noindex and nofollow", () => {
    expect(metadata.robots).toMatchObject({
      follow: false,
      index: false,
    });
  });
});
