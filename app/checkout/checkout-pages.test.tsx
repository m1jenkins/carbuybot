import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        retrieve: mocks.retrieve,
      },
    },
  }),
}));
vi.mock("@/components/auth/magic-link-form", () => ({
  MagicLinkForm: ({
    defaultEmail,
    destination,
  }: {
    defaultEmail: string;
    destination?: string;
  }) => (
    <div data-destination={destination} data-testid="magic-link">
      {defaultEmail}
    </div>
  ),
}));

import CancelPage from "./cancel/page";
import SuccessPage from "./success/page";

describe("Checkout result pages", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows paid display context and the prefilled magic-link form", async () => {
    mocks.retrieve.mockResolvedValue({
      amount_total: 34_900,
      client_reference_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
      currency: "usd",
      customer_details: { email: "buyer@example.com" },
      customer_email: null,
      id: "cs_test_paid_fixture_123",
      metadata: {
        engagement_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
      },
      mode: "payment",
      payment_status: "paid",
    });

    render(
      await SuccessPage({
        searchParams: Promise.resolve({
          session_id: "cs_test_paid_fixture_123",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /payment confirmed/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("$349.00")).toBeInTheDocument();
    expect(screen.getByTestId("magic-link")).toHaveTextContent(
      "buyer@example.com",
    );
    expect(screen.getByTestId("magic-link")).toHaveAttribute(
      "data-destination",
      "/portal?engagement=a6204b70-c308-40e8-b87f-30843d48cb79&payment=processing",
    );
    expect(mocks.retrieve).toHaveBeenCalledWith(
      "cs_test_paid_fixture_123",
    );
  });

  it("does not carry malformed or mismatched engagement metadata", async () => {
    mocks.retrieve.mockResolvedValue({
      amount_total: 34_900,
      client_reference_id: "a6204b70-c308-40e8-b87f-30843d48cb79",
      currency: "usd",
      customer_details: { email: "buyer@example.com" },
      customer_email: null,
      id: "cs_test_paid_fixture_123",
      metadata: {
        engagement_id: "00000000-0000-4000-8000-999999999999",
      },
      mode: "payment",
      payment_status: "paid",
    });

    render(
      await SuccessPage({
        searchParams: Promise.resolve({
          session_id: "cs_test_paid_fixture_123",
        }),
      }),
    );

    expect(screen.getByTestId("magic-link")).toHaveAttribute(
      "data-destination",
      "/portal?payment=processing",
    );
  });

  it("shows processing without creating access for an unpaid session", async () => {
    mocks.retrieve.mockResolvedValue({
      amount_total: 34_900,
      currency: "usd",
      customer_details: { email: "buyer@example.com" },
      customer_email: null,
      id: "cs_test_processing",
      mode: "payment",
      payment_status: "unpaid",
    });

    render(
      await SuccessPage({
        searchParams: Promise.resolve({
          session_id: "cs_test_processing",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /payment is processing/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("magic-link")).not.toBeInTheDocument();
  });

  it("does not show onboarding for a paid subscription-mode session", async () => {
    mocks.retrieve.mockResolvedValue({
      amount_total: 34_900,
      currency: "usd",
      customer_details: { email: "buyer@example.com" },
      customer_email: null,
      id: "cs_test_subscription",
      mode: "subscription",
      payment_status: "paid",
    });

    render(
      await SuccessPage({
        searchParams: Promise.resolve({
          session_id: "cs_test_subscription",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /not supported/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /payment confirmed/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("magic-link")).not.toBeInTheDocument();
  });

  it("never retrieves a live-mode Checkout Session", async () => {
    render(
      await SuccessPage({
        searchParams: Promise.resolve({ session_id: "cs_live_forbidden" }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /could not confirm/i }),
    ).toBeInTheDocument();
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(screen.queryByTestId("magic-link")).not.toBeInTheDocument();
  });

  it("offers a safe return path after cancellation", () => {
    render(<CancelPage />);

    expect(
      screen.getByRole("heading", { name: /checkout canceled/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return home/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
