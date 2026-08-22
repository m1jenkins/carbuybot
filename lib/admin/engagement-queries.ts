import type { createServerClient } from "@/lib/supabase/server";
import type { AdminQueueQuery } from "@/lib/domain/admin-query";
import { workflowStatuses } from "@/lib/domain/engagement";
import type { WorkflowStatus } from "@/lib/domain/engagement";

type AuthenticatedServerClient = Awaited<
  ReturnType<typeof createServerClient>
>;

export const ADMIN_QUEUE_PAGE_SIZE = 25;

const queueSelection =
  "amount_cents, created_at, currency, customer_email, id, payment_status, updated_at, workflow_status, profiles!engagements_user_id_fkey(full_name), vehicle_briefs(city, make, model, state, year_max, year_min)";

export async function loadWorkflowCounts(
  supabase: AuthenticatedServerClient,
): Promise<{
  counts: Record<WorkflowStatus, number> | null;
  error: unknown;
}> {
  const results = await Promise.all(
    workflowStatuses.map(async (status) => {
      const { count, error } = await supabase
        .from("engagements")
        .select("id", { count: "exact", head: true })
        .eq("workflow_status", status);
      return { count, error, status };
    }),
  );
  const failed = results.find(
    (result) => result.error || typeof result.count !== "number",
  );
  if (failed) {
    return {
      counts: null,
      error: failed.error ?? new Error("Exact workflow count unavailable"),
    };
  }

  return {
    counts: Object.fromEntries(
      results.map((result) => [result.status, result.count]),
    ) as Record<WorkflowStatus, number>,
    error: null,
  };
}

export async function loadAdminEngagementPage(
  supabase: AuthenticatedServerClient,
  query: AdminQueueQuery,
) {
  let request = supabase
    .from("engagements")
    .select(queueSelection, { count: "exact" });

  if (query.status !== "all") {
    request = request.eq("workflow_status", query.status);
  }
  if (query.payment !== "all") {
    request = request.eq("payment_status", query.payment);
  }
  if (query.searchId) {
    request = request.eq("id", query.searchId);
  } else if (query.emailPattern) {
    request = request.ilike("customer_email", `%${query.emailPattern}%`);
  }

  if (query.sort === "oldest") {
    request = request.order("created_at", { ascending: true });
  } else if (query.sort === "customer") {
    request = request.order("customer_email", { ascending: true });
  } else {
    request = request.order("created_at", { ascending: false });
  }

  const from = (query.page - 1) * ADMIN_QUEUE_PAGE_SIZE;
  return request
    .order("id", { ascending: true })
    .range(from, from + ADMIN_QUEUE_PAGE_SIZE - 1);
}
