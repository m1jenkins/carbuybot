import { describe, expect, it } from "vitest";

import {
  normalizeRequestedEngagementId,
  orderCustomerEngagements,
  selectCustomerEngagement,
} from "./engagement-selection";

const activeOlder = {
  created_at: "2026-08-20T08:00:00.000Z",
  id: "00000000-0000-4000-8000-000000000001",
  workflow_status: "searching" as const,
};
const activeNewer = {
  created_at: "2026-08-21T08:00:00.000Z",
  id: "00000000-0000-4000-8000-000000000002",
  workflow_status: "brief_submitted" as const,
};
const completedNewest = {
  created_at: "2026-08-22T08:00:00.000Z",
  id: "00000000-0000-4000-8000-000000000003",
  workflow_status: "completed" as const,
};
const cancelled = {
  created_at: "2026-08-19T08:00:00.000Z",
  id: "00000000-0000-4000-8000-000000000004",
  workflow_status: "cancelled" as const,
};

describe("customer engagement selection", () => {
  it("prioritizes active workflows, then newest creation time", () => {
    expect(
      orderCustomerEngagements([
        completedNewest,
        activeOlder,
        cancelled,
        activeNewer,
      ]).map(({ id }) => id),
    ).toEqual([
      activeNewer.id,
      activeOlder.id,
      completedNewest.id,
      cancelled.id,
    ]);
  });

  it("honors an owned requested engagement even when it is terminal", () => {
    expect(
      selectCustomerEngagement(
        [activeNewer, completedNewest],
        completedNewest.id,
      ),
    ).toEqual(completedNewest);
  });

  it("falls back deterministically for an invalid or unowned request", () => {
    expect(
      selectCustomerEngagement(
        [completedNewest, activeOlder, activeNewer],
        "00000000-0000-4000-8000-999999999999",
      ),
    ).toEqual(activeNewer);
    expect(
      selectCustomerEngagement(
        [completedNewest, activeOlder, activeNewer],
        "not-a-uuid",
      ),
    ).toEqual(activeNewer);
  });

  it("uses the ID as a stable tie-breaker", () => {
    const tiedLaterId = {
      ...activeNewer,
      id: "00000000-0000-4000-8000-000000000009",
    };
    const tiedEarlierId = {
      ...activeNewer,
      id: "00000000-0000-4000-8000-000000000008",
    };

    expect(
      orderCustomerEngagements([tiedLaterId, tiedEarlierId]).map(
        ({ id }) => id,
      ),
    ).toEqual([tiedEarlierId.id, tiedLaterId.id]);
  });

  it("accepts one UUID query value and rejects malformed values", () => {
    expect(normalizeRequestedEngagementId(activeNewer.id)).toBe(activeNewer.id);
    expect(
      normalizeRequestedEngagementId([activeOlder.id, activeNewer.id]),
    ).toBe(activeOlder.id);
    expect(normalizeRequestedEngagementId("not-a-uuid")).toBeNull();
    expect(normalizeRequestedEngagementId(undefined)).toBeNull();
  });
});
