// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { workflowStatuses } from "@/lib/domain/engagement";
import { parseAdminQueueSearchParams } from "@/lib/domain/admin-query";

import {
  ADMIN_QUEUE_PAGE_SIZE,
  loadAdminEngagementPage,
  loadWorkflowCounts,
} from "./engagement-queries";

describe("admin engagement queries", () => {
  it("loads exact workflow counts independently of the paginated queue", async () => {
    const countByStatus = Object.fromEntries(
      workflowStatuses.map((status, index) => [status, 1_500 + index]),
    );
    const select = vi.fn(() => ({
      eq: vi.fn((_column, status: keyof typeof countByStatus) =>
        Promise.resolve({
          count: countByStatus[status],
          data: null,
          error: null,
        }),
      ),
    }));
    const supabase = {
      from: vi.fn(() => ({ select })),
    };

    await expect(loadWorkflowCounts(supabase as never)).resolves.toEqual({
      counts: countByStatus,
      error: null,
    });
    expect(supabase.from).toHaveBeenCalledTimes(workflowStatuses.length);
    expect(select).toHaveBeenCalledTimes(workflowStatuses.length);
    expect(select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
  });

  it("applies allowlisted filters and email search before a bounded range", async () => {
    const callOrder: string[] = [];
    const result = { count: 81, data: [], error: null };
    const builder = {
      eq: vi.fn((column: string, value: string) => {
        callOrder.push(`eq:${column}:${value}`);
        return builder;
      }),
      ilike: vi.fn((column: string, value: string) => {
        callOrder.push(`ilike:${column}:${value}`);
        return builder;
      }),
      order: vi.fn((column: string, options: { ascending: boolean }) => {
        callOrder.push(`order:${column}:${options.ascending}`);
        return builder;
      }),
      range: vi.fn(async (from: number, to: number) => {
        callOrder.push(`range:${from}:${to}`);
        return result;
      }),
      select: vi.fn(() => {
        callOrder.push("select");
        return builder;
      }),
    };
    const supabase = { from: vi.fn(() => builder) };
    const query = parseAdminQueueSearchParams({
      page: "3",
      payment: "paid",
      q: "Buyer_100%@Example.com",
      sort: "customer",
      status: "searching",
    });

    await expect(
      loadAdminEngagementPage(supabase as never, query),
    ).resolves.toBe(result);
    expect(builder.select).toHaveBeenCalledWith(expect.any(String), {
      count: "exact",
    });
    expect(builder.eq).toHaveBeenCalledWith("workflow_status", "searching");
    expect(builder.eq).toHaveBeenCalledWith("payment_status", "paid");
    expect(builder.ilike).toHaveBeenCalledWith(
      "customer_email",
      "%buyer\\_100\\%@example.com%",
    );
    expect(builder.order).toHaveBeenCalledWith("customer_email", {
      ascending: true,
    });
    expect(builder.range).toHaveBeenCalledWith(
      ADMIN_QUEUE_PAGE_SIZE * 2,
      ADMIN_QUEUE_PAGE_SIZE * 3 - 1,
    );
    expect(callOrder.indexOf("range:50:74")).toBeGreaterThan(
      callOrder.indexOf(
        "ilike:customer_email:%buyer\\_100\\%@example.com%",
      ),
    );
  });

  it("uses equality for exact engagement IDs before pagination", async () => {
    const id = "a6204b70-c308-40e8-b87f-30843d48cb79";
    const builder = {
      eq: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(async () => ({ count: 1, data: [], error: null })),
      select: vi.fn(() => builder),
    };
    const supabase = { from: vi.fn(() => builder) };

    await loadAdminEngagementPage(
      supabase as never,
      parseAdminQueueSearchParams({ q: id }),
    );

    expect(builder.eq).toHaveBeenCalledWith("id", id);
    expect(builder.ilike).not.toHaveBeenCalled();
    expect(builder.eq.mock.invocationCallOrder[0]).toBeLessThan(
      builder.range.mock.invocationCallOrder[0],
    );
  });
});
