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
});
