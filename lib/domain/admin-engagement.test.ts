import { describe, expect, it } from "vitest";

import {
  getAllowedTransitions,
  validateTransition,
} from "./admin-engagement";

describe("admin workflow context", () => {
  it("offers operational transitions only for paid engagements with a brief", () => {
    expect(
      getAllowedTransitions("brief_submitted", {
        hasBrief: true,
        paymentStatus: "paid",
      }),
    ).toEqual(["in_review", "cancelled"]);
    expect(
      getAllowedTransitions("brief_submitted", {
        hasBrief: true,
        paymentStatus: "refunded",
      }),
    ).toEqual([]);
    expect(
      getAllowedTransitions("brief_submitted", {
        hasBrief: false,
        paymentStatus: "paid",
      }),
    ).toEqual(["cancelled"]);
  });

  it("keeps paid pre-brief cancellation but reserves submission for customers", () => {
    expect(
      getAllowedTransitions("awaiting_brief", {
        hasBrief: false,
        paymentStatus: "paid",
      }),
    ).toEqual(["cancelled"]);
    expect(() =>
      validateTransition("awaiting_brief", "brief_submitted", {
        hasBrief: true,
        paymentStatus: "paid",
      }),
    ).toThrow(/not allowed/i);
  });
});
