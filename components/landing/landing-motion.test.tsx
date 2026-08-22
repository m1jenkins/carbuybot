import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingMotion } from "./landing-motion";

describe("LandingMotion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reveals static content without animation timers or parallax when motion is reduced", () => {
    const intersectionObserver = vi.fn(function MockIntersectionObserver() {
      return {
        disconnect: vi.fn(),
        observe: vi.fn(),
        takeRecords: vi.fn(),
        unobserve: vi.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
      };
    });
    const requestAnimationFrame = vi.fn();
    const setTimeout = vi.spyOn(window, "setTimeout");
    vi.stubGlobal("IntersectionObserver", intersectionObserver);
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );

    render(
      <>
        <LandingMotion />
        <header id="hdr" />
        <section id="top">
          <div
            className="plate__media"
            data-testid="plate"
            style={{ transform: "translateY(0px)" }}
          />
        </section>
        <div id="mcta" />
        <section id="start" />
        <div className="rv" data-testid="reveal" />
      </>,
    );

    expect(screen.getByTestId("reveal")).toHaveClass("in");
    expect(screen.getByTestId("plate")).toHaveStyle({
      transform: "translateY(0px)",
    });
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(setTimeout).not.toHaveBeenCalled();
  });
});
