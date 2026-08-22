import { cleanup, render, screen, within } from "@testing-library/react";
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

const counts = {
  awaiting_brief: 1_100,
  brief_submitted: 1_250,
  cancelled: 75,
  completed: 90,
  in_review: 800,
  negotiating: 300,
  offers_ready: 120,
  searching: 2_000,
};

const queueQuery = {
  emailPattern: null,
  page: 2,
  payment: "paid" as const,
  search: "buyer@example.com",
  searchId: null,
  sort: "customer" as const,
  status: "searching" as const,
};

describe("admin queue dashboard", () => {
  afterEach(cleanup);

  it("shows exact global workflow totals and links each vehicle to review", () => {
    render(
      <AdminOverview
        counts={counts}
        engagements={[genesis, bmw]}
        filteredCount={81}
        pageCount={4}
        query={queueQuery}
      />,
    );

    const needsReview = within(
      screen.getByRole("list", { name: /workflow queue counts/i }),
    )
      .getByText("Needs review")
      .closest("li");
    expect(needsReview).not.toBeNull();
    expect(within(needsReview!).getByText("1,250")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /2024–2025 Genesis GV80/i }),
    ).toHaveAttribute(
      "href",
      "/admin/engagements/a6204b70-c308-40e8-b87f-30843d48cb79",
    );
    expect(
      screen.getByRole("table", { name: /engagement review queue/i }),
    ).toBeVisible();
    const queue = screen.getByRole("table", {
      name: /engagement review queue/i,
    });
    expect(within(queue).getByText("Paid")).not.toHaveClass("money");
    for (const amount of within(queue).getAllByText("$349.00")) {
      expect(amount).toHaveClass("money");
    }
    expect(screen.getByText("buyer@example.com").closest("td")).toHaveAttribute(
      "data-label",
      "Customer",
    );
  });

  it("submits server filters and exposes accessible bounded pagination", () => {
    render(
      <AdminOverview
        counts={counts}
        engagements={[genesis, bmw]}
        filteredCount={81}
        pageCount={4}
        query={queueQuery}
      />,
    );

    expect(screen.getByLabelText(/search engagements/i)).toHaveValue(
      "buyer@example.com",
    );
    expect(screen.getByLabelText(/filter by workflow/i)).toHaveValue(
      "searching",
    );
    expect(screen.getByLabelText(/filter by payment/i)).toHaveValue("paid");
    expect(screen.getByLabelText(/sort engagements/i)).toHaveValue("customer");
    expect(
      screen.getByRole("button", { name: /apply filters/i }),
    ).toBeVisible();
    expect(screen.getByText("Showing 26–27 of 81 engagements.")).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: /queue pages/i }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /previous page/i })).toHaveAttribute(
      "href",
      expect.stringContaining("page=1"),
    );
    expect(screen.getByRole("link", { name: /next page/i })).toHaveAttribute(
      "href",
      expect.stringContaining("page=3"),
    );
  });
});

describe("admin engagement review", () => {
  afterEach(cleanup);

  it("shows customer, payment, complete brief, history, and controlled next steps", () => {
    render(
      <EngagementReview
        brief={fullBrief}
        engagement={genesis}
        historyPage={1}
        historyPageCount={3}
        historyTotal={45}
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
    expect(screen.getByText("Paid")).not.toHaveClass("money");
    expect(
      screen.getByRole("heading", { level: 1, name: /3.5T Prestige/i }),
    ).toBeVisible();
    expect(screen.getByText(/AWD, Advanced safety package/i)).toBeVisible();
    expect(screen.getByText(/2018 Honda Accord/i)).toBeVisible();
    expect(screen.getByText("Consent recorded")).toBeVisible();
    expect(screen.getByText("Brief received")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /load older updates/i }),
    ).toHaveAttribute(
      "href",
      `/admin/engagements/${genesis.id}?historyPage=2#admin-history-title`,
    );

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
    expect(() =>
      validateTransition("completed", "searching", {
        hasBrief: true,
        paymentStatus: "paid",
      }),
    ).toThrow(/not allowed/i);
  });
});
