import { describe, expect, it } from "vitest";

import { briefSchema } from "./brief";
import {
  canTransition,
  normalizeEmail,
  workflowStatuses,
} from "./engagement";

const validBrief = {
  condition: "either",
  make: " Genesis ",
  model: " GV80 ",
  yearMin: 2022,
  yearMax: 2025,
  trim: " 3.5T Prestige ",
  colors: [" Savile Silver ", "Uyuni White"],
  options: [" AWD ", "Advanced safety package"],
  dealBreakers: ["Salvage title"],
  budgetCents: 6_000_000,
  city: " Austin ",
  state: "tx",
  postalCode: "78701",
  searchRadiusMiles: 100,
  timeline: "within_30_days",
  hasTradeIn: true,
  tradeInDetails: "2018 Honda Accord with about 70,000 miles",
  financingPreference: "loan",
  notes: "Prefer a clean one-owner vehicle.",
  consent: true,
} as const;

describe("briefSchema", () => {
  it("accepts and normalizes a complete vehicle brief", () => {
    const parsed = briefSchema.parse(validBrief);

    expect(parsed).toMatchObject({
      make: "Genesis",
      model: "GV80",
      state: "TX",
      colors: ["Savile Silver", "Uyuni White"],
      options: ["AWD", "Advanced safety package"],
    });
  });

  it("rejects an invalid US postal code", () => {
    expect(
      briefSchema.safeParse({ ...validBrief, postalCode: "12" }).success,
    ).toBe(false);
  });

  it("accepts a ZIP+4 postal code", () => {
    expect(
      briefSchema.safeParse({ ...validBrief, postalCode: "78701-1234" })
        .success,
    ).toBe(true);
  });

  it.each([0, -1, 1.5])("rejects invalid budget cents: %s", (budgetCents) => {
    expect(
      briefSchema.safeParse({ ...validBrief, budgetCents }).success,
    ).toBe(false);
  });

  it.each([0, 501])("rejects an out-of-range search radius: %s", (radius) => {
    expect(
      briefSchema.safeParse({
        ...validBrief,
        searchRadiusMiles: radius,
      }).success,
    ).toBe(false);
  });

  it("rejects a reversed year range", () => {
    expect(
      briefSchema.safeParse({
        ...validBrief,
        yearMin: 2025,
        yearMax: 2020,
      }).success,
    ).toBe(false);
  });

  it("allows the optional year range and trim to be omitted", () => {
    const brief: Record<string, unknown> = { ...validBrief };
    delete brief.yearMin;
    delete brief.yearMax;
    delete brief.trim;

    expect(briefSchema.safeParse(brief).success).toBe(true);
  });

  it.each([
    ["condition", "certified"],
    ["timeline", "someday"],
    ["financingPreference", "barter"],
  ])("rejects an unsupported %s value", (field, value) => {
    expect(
      briefSchema.safeParse({ ...validBrief, [field]: value }).success,
    ).toBe(false);
  });

  it("requires explicit consent", () => {
    expect(
      briefSchema.safeParse({ ...validBrief, consent: false }).success,
    ).toBe(false);
  });
});

describe("engagement domain", () => {
  it("normalizes a valid customer email", () => {
    expect(normalizeEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
  });

  it("rejects an invalid customer email", () => {
    expect(() => normalizeEmail("not-an-email")).toThrow();
  });

  it("permits the next workflow step", () => {
    expect(canTransition("brief_submitted", "in_review")).toBe(true);
  });

  it("rejects a transition out of a terminal state", () => {
    expect(canTransition("completed", "searching")).toBe(false);
  });

  it("defines every workflow state expected by persistence", () => {
    expect(workflowStatuses).toEqual([
      "awaiting_brief",
      "brief_submitted",
      "in_review",
      "searching",
      "negotiating",
      "offers_ready",
      "completed",
      "cancelled",
    ]);
  });
});
