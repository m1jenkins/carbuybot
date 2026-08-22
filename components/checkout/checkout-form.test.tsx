import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { navigateToCheckout } from "./checkout-navigation";
import { CheckoutForm } from "./checkout-form";

vi.mock("./checkout-navigation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./checkout-navigation")>();
  return { ...actual, navigateToCheckout: vi.fn() };
});

describe("CheckoutForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts the email contract and follows a validated Stripe Checkout URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        url: "https://checkout.stripe.com/c/pay/test-session",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckoutForm defaultEmail="buyer@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /start my search/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "buyer@example.com" }),
      });
    });
    expect(navigateToCheckout).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/pay/test-session",
    );
  });

  it("rejects a lookalike host instead of navigating", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          url: "https://checkout.stripe.com.evil.example/session",
        }),
      }),
    );

    render(<CheckoutForm defaultEmail="buyer@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /start my search/i }));

    expect(
      await screen.findByText("Checkout returned an invalid destination."),
    ).toBeInTheDocument();
    expect(navigateToCheckout).not.toHaveBeenCalled();
  });
});
