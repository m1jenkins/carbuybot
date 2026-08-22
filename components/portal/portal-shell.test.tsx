import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PortalShell } from "./portal-shell";

const engagement = {
  amount_cents: 34_900,
  created_at: "2026-08-20T12:00:00.000Z",
  currency: "usd",
  id: "a6204b70-c308-40e8-b87f-30843d48cb79",
  payment_status: "paid" as const,
  stripe_checkout_session_id: "cs_test_customer_reference",
  stripe_payment_intent_id: "pi_test_customer_reference",
  workflow_status: "brief_submitted" as const,
};

const brief = {
  budget_cents: 6_000_000,
  city: "Austin",
  colors: ["Black"],
  condition: "either" as const,
  deal_breakers: ["No accident history"],
  financing_preference: "undecided" as const,
  has_trade_in: false,
  make: "Genesis",
  model: "GV80",
  notes: "Open to a nearby state.",
  options: ["Advanced package"],
  postal_code: "78701",
  search_radius_miles: 100,
  state: "TX",
  timeline: "within_30_days" as const,
  trade_in_details: null,
  trim: null,
  year_max: 2025,
  year_min: 2025,
};

const updates = [
  {
    created_at: "2026-08-22T16:30:00.000Z",
    customer_visible: true,
    id: "update-later",
    note: "Your buying agent will review the constraints before searching.",
    status: "brief_submitted" as const,
    title: "Review is next",
  },
  {
    created_at: "2026-08-21T08:00:00.000Z",
    customer_visible: false,
    id: "update-internal",
    note: "Internal only",
    status: "brief_submitted" as const,
    title: "Internal handoff",
  },
  {
    created_at: "2026-08-22T15:00:00.000Z",
    customer_visible: true,
    id: "update-earlier",
    note: "We received the vehicle brief.",
    status: "brief_submitted" as const,
    title: "Brief submitted",
  },
];

describe("PortalShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the current stage, truthful next step, vehicle, and payment record", () => {
    render(
      <PortalShell
        brief={brief}
        engagement={engagement}
        signOutAction={vi.fn()}
        updates={updates}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /brief submitted/i }),
    ).toBeVisible();
    expect(
      screen.getByText(/your buying agent will review your brief/i),
    ).toBeVisible();
    expect(screen.getByText(/2025 Genesis GV80/i)).toBeVisible();
    expect(screen.getByText("$349.00")).toHaveClass("money");
    expect(screen.getByText("cs_test_customer_reference")).toBeVisible();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeVisible();
  });

  it("renders only customer-visible updates from oldest to newest", () => {
    render(
      <PortalShell
        brief={brief}
        engagement={engagement}
        updates={updates}
      />,
    );

    expect(screen.queryByText(/internal only/i)).not.toBeInTheDocument();
    const timeline = screen.getByRole("list", { name: /status updates/i });
    const items = within(timeline).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Brief submitted");
    expect(items[1]).toHaveTextContent("Review is next");
    expect(items[0].querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-08-22T15:00:00.000Z",
    );
  });

  it("offers brief revision only in an editable workflow stage", () => {
    const { rerender } = render(
      <PortalShell
        brief={brief}
        engagement={engagement}
        updates={updates}
      />,
    );

    expect(
      screen.getByRole("link", { name: /revise brief/i }),
    ).toHaveAttribute("href", "/onboarding");

    rerender(
      <PortalShell
        brief={brief}
        engagement={{ ...engagement, workflow_status: "in_review" }}
        updates={updates}
      />,
    );
    expect(
      screen.queryByRole("link", { name: /revise brief/i }),
    ).not.toBeInTheDocument();
  });

  it("states plainly when there is no brief or update yet", () => {
    render(
      <PortalShell
        brief={null}
        engagement={{ ...engagement, workflow_status: "awaiting_brief" }}
        updates={[]}
      />,
    );

    expect(screen.getByText(/complete your vehicle brief/i)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /complete brief/i }),
    ).toHaveAttribute("href", "/onboarding");
    expect(
      screen.getByText(/no customer updates have been posted yet/i),
    ).toBeVisible();
    expect(
      screen.getByText(/vehicle details will appear after you submit/i),
    ).toBeVisible();
  });
});
