import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validateTransition } from "@/lib/domain/admin-engagement";

import { AdminOverview } from "./admin-overview";
import { EngagementReview } from "./engagement-review";

const genesis = {
  amountCents: 34_900,
  createdAt: "2026-08-20T12:00:00.000Z",
  currency: "usd",
  customerEmail: "buyer@example.com",
  customerName: "Jordan Lee",
  id: "a6204b70-c308-40e8-b87f-30843d48cb79",
  onboardingCompletedAt: "2026-08-20T13:00:00.000Z",
  paymentStatus: "paid" as const,
  stripeCheckoutSessionId: "cs_test_customer_reference",
  stripeCustomerId: "cus_test_customer",
  stripePaymentIntentId: "pi_test_customer_reference",
  updatedAt: "2026-08-22T12:00:00.000Z",
  vehicle: {
    city: "Austin",
    make: "Genesis",
    model: "GV80",
    state: "TX",
    yearMax: 2025,
    yearMin: 2024,
  },
  workflowStatus: "brief_submitted" as const,
};

const bmw = {
  ...genesis,
  createdAt: "2026-08-21T12:00:00.000Z",
  customerEmail: "second@example.com",
  customerName: null,
  id: "83aca8da-9a4d-4b26-9414-7f444c39fc3d",
  paymentStatus: "pending" as const,
  vehicle: {
    city: "Denver",
    make: "BMW",
    model: "X5",
    state: "CO",
    yearMax: 2026,
    yearMin: 2026,
  },
  workflowStatus: "searching" as const,
};

const fullBrief = {
  budgetCents: 6_000_000,
  city: "Austin",
  colors: ["Savile Silver", "Uyuni White"],
  condition: "either" as const,
  consent: true,
  createdAt: "2026-08-20T13:00:00.000Z",
  dealBreakers: ["No salvage title"],
  financingPreference: "loan" as const,
  hasTradeIn: true,
  make: "Genesis",
  model: "GV80",
  notes: "Prefer a clean one-owner vehicle.",
  options: ["AWD", "Advanced safety package"],
  postalCode: "78701",
  searchRadiusMiles: 100,
  state: "TX",
  timeline: "within_30_days" as const,
  tradeInDetails: "2018 Honda Accord, about 70,000 miles",
  trim: "3.5T Prestige",
  updatedAt: "2026-08-22T14:00:00.000Z",
  yearMax: 2025,
  yearMin: 2024,
};

describe("admin queue dashboard", () => {
  afterEach(cleanup);

  it("shows real workflow totals and links each vehicle to review", () => {
    render(<AdminOverview engagements={[genesis, bmw]} />);

    const needsReview = within(
      screen.getByRole("list", { name: /workflow queue counts/i }),
    )
      .getByText("Needs review")
      .closest("li");
    expect(needsReview).not.toBeNull();
    expect(within(needsReview!).getByText("1")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /2024–2025 Genesis GV80/i }),
    ).toHaveAttribute(
      "href",
      "/admin/engagements/a6204b70-c308-40e8-b87f-30843d48cb79",
    );
    expect(
      screen.getByRole("table", { name: /engagement review queue/i }),
    ).toBeVisible();
    expect(screen.getByText("buyer@example.com").closest("td")).toHaveAttribute(
      "data-label",
      "Customer",
    );
  });

  it("filters by workflow and sorts the visible labelled records", () => {
    render(<AdminOverview engagements={[genesis, bmw]} />);

    fireEvent.change(screen.getByLabelText(/filter by workflow/i), {
      target: { value: "searching" },
    });
    expect(
      screen.queryByRole("link", { name: /Genesis GV80/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /BMW X5/i })).toBeVisible();

    fireEvent.change(screen.getByLabelText(/filter by workflow/i), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText(/sort engagements/i), {
      target: { value: "oldest" },
    });
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByRole("link")).toHaveTextContent("Genesis GV80");
    expect(within(rows[1]).getByRole("link")).toHaveTextContent("BMW X5");
  });
});

describe("admin engagement review", () => {
  afterEach(cleanup);

  it("shows customer, payment, complete brief, history, and controlled next steps", () => {
    render(
      <EngagementReview
        brief={fullBrief}
        engagement={genesis}
        statusAction={vi.fn()}
        updates={[
          {
            authorId: "admin-1",
            createdAt: "2026-08-22T15:00:00.000Z",
            customerVisible: true,
            id: "update-1",
            note: "We received your brief and are reviewing the constraints.",
            status: "brief_submitted",
            title: "Brief received",
          },
        ]}
      />,
    );

    expect(screen.getByText("buyer@example.com")).toBeVisible();
    expect(screen.getByText("$349.00")).toHaveClass("money");
    expect(
      screen.getByRole("heading", { level: 1, name: /3.5T Prestige/i }),
    ).toBeVisible();
    expect(screen.getByText(/AWD, Advanced safety package/i)).toBeVisible();
    expect(screen.getByText(/2018 Honda Accord/i)).toBeVisible();
    expect(screen.getByText("Consent recorded")).toBeVisible();
    expect(screen.getByText("Brief received")).toBeVisible();

    const nextStatus = screen.getByLabelText(/next workflow status/i);
    expect(
      within(nextStatus).getByRole("option", { name: /brief in review/i }),
    ).toBeVisible();
    expect(
      within(nextStatus).queryByRole("option", { name: /vehicle search/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/customer-visible title/i)).toBeRequired();
    expect(screen.getByLabelText(/customer-visible note/i)).toBeRequired();
  });

  it("rejects an impossible workflow transition", () => {
    expect(() => validateTransition("completed", "searching")).toThrow(
      /not allowed/i,
    );
  });
});
