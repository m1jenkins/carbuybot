import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("renders the primary value proposition and search actions", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: /let a bot haggle/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /start my search/i }).length,
    ).toBeGreaterThan(0);
  });

  it("states the actual Checkout-before-brief payment sequence", () => {
    render(<LandingPage />);

    expect(
      screen.getAllByText(/checkout first, then complete your vehicle brief/i),
    ).not.toHaveLength(0);
    expect(
      screen.queryByText(/charge .* only after you confirm your brief/i),
    ).not.toBeInTheDocument();
  });
});
