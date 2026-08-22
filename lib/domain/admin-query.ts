import { z } from "zod";

import { workflowStatusSchema } from "./engagement";
import type { WorkflowStatus } from "./engagement";

const paymentStatusSchema = z.enum(["pending", "paid", "failed", "refunded"]);
const sortSchema = z.enum(["newest", "oldest", "customer"]);
const pageSchema = z.coerce.number().int().min(1).max(10_000);
const searchSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(320)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value));

type SearchParams = Record<string, string | string[] | undefined>;

export const ADMIN_HISTORY_PAGE_SIZE = 20;

export type AdminQueueQuery = {
  emailPattern: string | null;
  page: number;
  payment: "all" | z.infer<typeof paymentStatusSchema>;
  search: string;
  searchId: string | null;
  sort: z.infer<typeof sortSchema>;
  status: "all" | WorkflowStatus;
};

function scalar(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parsePage(value: string | string[] | undefined): number {
  const parsed = pageSchema.safeParse(scalar(value));
  return parsed.success ? parsed.data : 1;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function parseAdminQueueSearchParams(
  params: SearchParams,
): AdminQueueQuery {
  const status = workflowStatusSchema.safeParse(scalar(params.status));
  const payment = paymentStatusSchema.safeParse(scalar(params.payment));
  const sort = sortSchema.safeParse(scalar(params.sort));
  const search = searchSchema.safeParse(scalar(params.q));
  const normalizedSearch = search.success ? search.data : "";
  const searchId = z.uuid().safeParse(normalizedSearch);

  return {
    emailPattern:
      normalizedSearch && !searchId.success
        ? escapeLikePattern(normalizedSearch)
        : null,
    page: parsePage(params.page),
    payment: payment.success ? payment.data : "all",
    search: normalizedSearch,
    searchId: searchId.success ? searchId.data.toLowerCase() : null,
    sort: sort.success ? sort.data : "newest",
    status: status.success ? status.data : "all",
  };
}

export function parseAdminHistorySearchParams(params: SearchParams): {
  historyPage: number;
} {
  return { historyPage: parsePage(params.historyPage) };
}
