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
const completedEngagement = {
  ...engagement,
  created_at: "2026-08-22T12:00:00.000Z",
  id: "83aca8da-9a4d-4b26-9414-7f444c39fc3d",
  workflow_status: "completed" as const,
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
        engagements={[engagement, completedEngagement]}
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
        engagements={[engagement, completedEngagement]}
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
        engagements={[engagement, completedEngagement]}
        updates={updates}
      />,
    );

    expect(
      screen.getByRole("link", { name: /revise brief/i }),
    ).toHaveAttribute(
      "href",
      `/onboarding?engagement=${engagement.id}`,
    );

    rerender(
      <PortalShell
        brief={brief}
        engagement={{ ...engagement, workflow_status: "in_review" }}
        engagements={[
          { ...engagement, workflow_status: "in_review" },
          completedEngagement,
        ]}
        updates={updates}
      />,
    );
    expect(
      screen.queryByRole("link", { name: /revise brief/i }),
    ).not.toBeInTheDocument();

    rerender(
      <PortalShell
        brief={brief}
        engagement={{ ...engagement, payment_status: "refunded" }}
        engagements={[
          { ...engagement, payment_status: "refunded" },
          completedEngagement,
        ]}
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
        engagements={[
          { ...engagement, workflow_status: "awaiting_brief" },
          completedEngagement,
        ]}
        updates={[]}
      />,
    );

    expect(screen.getByText(/complete your vehicle brief/i)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /complete brief/i }),
    ).toHaveAttribute(
      "href",
      `/onboarding?engagement=${engagement.id}`,
    );
    expect(
      screen.getByText(/no customer updates have been posted yet/i),
    ).toBeVisible();
    expect(
      screen.getByText(/vehicle details will appear after you submit/i),
    ).toBeVisible();
  });

  it("states that a refunded engagement has no scheduled next action", () => {
    const refundedEngagement = {
      ...engagement,
      payment_status: "refunded" as const,
      workflow_status: "awaiting_brief" as const,
    };

    render(
      <PortalShell
        brief={null}
        engagement={refundedEngagement}
        engagements={[refundedEngagement, completedEngagement]}
        updates={[]}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /payment refunded/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/no further work is scheduled for this engagement/i),
    ).toBeVisible();
    expect(screen.queryByText(/complete your vehicle brief/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /complete brief/i }),
    ).not.toBeInTheDocument();
  });

  it("lists every owned engagement and marks the selected one", () => {
    render(
      <PortalShell
        brief={brief}
        engagement={engagement}
        engagements={[engagement, completedEngagement]}
        updates={updates}
      />,
    );

    const switcher = screen.getByRole("navigation", {
      name: /your engagements/i,
    });
    const links = within(switcher).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      "href",
      `/portal?engagement=${engagement.id}`,
    );
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).toHaveAttribute(
      "href",
      `/portal?engagement=${completedEngagement.id}`,
    );
    expect(links[1]).not.toHaveAttribute("aria-current");
  });

  it("separates unavailable payment references from the engagement reference", () => {
    render(
      <PortalShell
        brief={brief}
        engagement={{
          ...engagement,
          stripe_checkout_session_id: null,
          stripe_payment_intent_id: null,
        }}
        engagements={[engagement]}
        updates={updates}
      />,
    );

    expect(screen.getByText("Payment reference").nextElementSibling).toHaveTextContent(
      "Unavailable",
    );
    expect(
      screen.getByText("Engagement reference").nextElementSibling,
    ).toHaveTextContent(engagement.id);
  });
});
