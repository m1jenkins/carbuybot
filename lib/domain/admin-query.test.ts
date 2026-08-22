import { describe, expect, it } from "vitest";

import {
  parseAdminHistorySearchParams,
  parseAdminQueueSearchParams,
} from "./admin-query";

describe("admin query parsing", () => {
  it("allowlists queue filters, bounds pages, and escapes email wildcards", () => {
    expect(
      parseAdminQueueSearchParams({
        page: "3",
        payment: "paid",
        q: " Buyer_100%@Example.COM ",
        sort: "customer",
        status: "searching",
      }),
    ).toEqual({
      emailPattern: "buyer\\_100\\%@example.com",
      page: 3,
      payment: "paid",
      search: "buyer_100%@example.com",
      searchId: null,
      sort: "customer",
      status: "searching",
    });

    expect(
      parseAdminQueueSearchParams({
        page: "10001",
        payment: "succeeded",
        q: "\u0000unsafe",
        sort: "vehicle",
        status: "invented",
      }),
    ).toEqual({
      emailPattern: null,
      page: 1,
      payment: "all",
      search: "",
      searchId: null,
      sort: "newest",
      status: "all",
    });
  });

  it("recognizes exact engagement UUID searches", () => {
    const id = "A6204B70-C308-40E8-B87F-30843D48CB79";
    expect(parseAdminQueueSearchParams({ q: id })).toMatchObject({
      emailPattern: null,
      search: id.toLowerCase(),
      searchId: id.toLowerCase(),
    });
  });

  it("safely parses bounded status-history pages", () => {
    expect(parseAdminHistorySearchParams({ historyPage: "7" })).toEqual({
      historyPage: 7,
    });
    expect(parseAdminHistorySearchParams({ historyPage: ["2", "3"] })).toEqual({
      historyPage: 1,
    });
    expect(parseAdminHistorySearchParams({ historyPage: "-1" })).toEqual({
      historyPage: 1,
    });
  });
});
