import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import RootLayout, { metadata } from "@/app/layout";

import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the primary value proposition and search actions", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: /let a bot haggle/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /start my search/i }).length,
    ).toBeGreaterThan(0);
  });

  it("shows the compiled deal sheet between the offer cards and the comparison", () => {
    render(<LandingPage />);

    const dealSheet = document.getElementById("deal-sheet");
    const compare = document.getElementById("compare");
    expect(dealSheet).toBeInstanceOf(HTMLElement);
    expect(compare).toBeInstanceOf(HTMLElement);
    if (!(dealSheet instanceof HTMLElement) || !(compare instanceof HTMLElement)) {
      throw new Error("Expected deal sheet and compare sections");
    }
    expect(
      dealSheet.compareDocumentPosition(compare) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /one sheet, not forty emails/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: /out-the-door quotes compiled from every dealer that replied/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("gv80-3.5t-prestige.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Yours to keep")).toBeInTheDocument();
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

  it("qualifies every rendered introductory price and fee-based guarantee", () => {
    render(<LandingPage />);
    const renderedCopy = document.body.textContent?.replace(/\s+/g, " ") ?? "";

    expect(renderedCopy).not.toMatch(/\$349\s+flat\b/i);
    expect(renderedCopy).not.toMatch(/save more than \$349/i);
    expect(renderedCopy).not.toMatch(/your agent costs \$349\b/i);
    expect(renderedCopy).not.toMatch(/refunded if it saves you less/i);
    expect(
      screen.getAllByText(/\$349 intro\s*\/\s*\$399 standard/i).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      screen.getByText(/save more than your service fee/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/first 100 checkout reservations/i).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("statically rejects unconditional fixed-price marketing claims", () => {
    const marketingSource = [
      "app/layout.tsx",
      "components/landing/landing-page.tsx",
      "components/landing/deal-sheet.tsx",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    for (const unconditionalClaim of [
      /\$349\s+flat\b/i,
      /save more than \$349/i,
      /your agent costs \$349\b/i,
      /refunded if it saves you less/i,
    ]) {
      expect(marketingSource).not.toMatch(unconditionalClaim);
    }
  });

  it("models the price range in metadata and structured data", () => {
    const metadataCopy = JSON.stringify(metadata);
    expect(metadataCopy).not.toMatch(/\$349\s+flat\b/i);
    expect(metadataCopy).not.toMatch(/save more than (?:that|\$349)/i);
    expect(metadataCopy).toMatch(/\$349 intro\s*\/\s*\$399 standard/i);

    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Pricing metadata test</main>
      </RootLayout>,
    );
    const encodedStructuredData = markup.match(
      /<script type="application\/ld\+json">([^<]+)<\/script>/,
    )?.[1];
    expect(encodedStructuredData).toBeDefined();
    const graph = JSON.parse(encodedStructuredData ?? "{}")["@graph"] as Array<
      Record<string, unknown>
    >;
    const organization = graph.find(
      (entry) =>
        Array.isArray(entry["@type"]) &&
        entry["@type"].includes("Organization"),
    );
    const product = graph.find((entry) => entry["@type"] === "Product");
    const offers = product?.offers as Record<string, unknown>;

    expect(organization?.priceRange).toBe("$349–$399");
    expect(offers).toMatchObject({
      "@type": "AggregateOffer",
      highPrice: "399.00",
      lowPrice: "349.00",
      offerCount: 2,
      priceCurrency: "USD",
    });
    expect(offers.offers).toEqual([
      expect.objectContaining({
        "@type": "Offer",
        description: expect.stringMatching(/first 100 checkout reservations/i),
        price: "349.00",
      }),
      expect.objectContaining({
        "@type": "Offer",
        description: expect.stringMatching(/standard price/i),
        price: "399.00",
      }),
    ]);
  });
});
