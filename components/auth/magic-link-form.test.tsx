import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => ({
    auth: { signInWithOtp: mocks.signInWithOtp },
  }),
}));

import { MagicLinkForm } from "./magic-link-form";

describe("MagicLinkForm", () => {
  beforeEach(() => {
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("prefills, normalizes, and requests a Supabase magic link", async () => {
    render(<MagicLinkForm defaultEmail="buyer@example.com" />);
    const email = screen.getByRole("textbox", { name: /email/i });
    expect(email).toHaveValue("buyer@example.com");

    fireEvent.change(email, { target: { value: " Buyer@Example.COM " } });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(mocks.signInWithOtp).toHaveBeenCalledWith({
        email: "buyer@example.com",
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fonboarding`,
          shouldCreateUser: true,
        },
      });
    });
    expect(
      await screen.findByText(/check buyer@example\.com/i),
    ).toBeInTheDocument();
  });

  it("shows a safe retry message when Supabase rejects the request", async () => {
    mocks.signInWithOtp.mockResolvedValue({
      data: {},
      error: new Error("provider detail"),
    });

    render(<MagicLinkForm defaultEmail="buyer@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    expect(
      await screen.findByText(/could not send the link/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("provider detail")).not.toBeInTheDocument();
  });
});
