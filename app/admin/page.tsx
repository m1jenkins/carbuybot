import { AdminOverview } from "@/components/admin/admin-overview";
import { redirect } from "next/navigation";
import type {
  AdminQueueEngagement,
  AdminVehicleSummary,
} from "@/components/admin/types";
import {
  ADMIN_QUEUE_PAGE_SIZE,
  loadAdminEngagementPage,
  loadWorkflowCounts,
} from "@/lib/admin/engagement-queries";
import {
  hasSupabaseConfiguration,
  requireAdmin,
} from "@/lib/auth/admin";
import {
  adminQueueHref,
  parseAdminQueueSearchParams,
} from "@/lib/domain/admin-query";
import type { Tables } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase/server";

type RawQueueEngagement = Pick<
  Tables<"engagements">,
  | "amount_cents"
  | "created_at"
  | "currency"
  | "customer_email"
  | "id"
  | "payment_status"
  | "updated_at"
  | "workflow_status"
> & {
  profiles: { full_name: string | null } | null;
  vehicle_briefs:
    | {
        city: string;
        make: string;
        model: string;
        state: string;
        year_max: number | null;
        year_min: number | null;
      }
    | null;
};

function normalizeQueueEngagement(
  row: RawQueueEngagement,
): AdminQueueEngagement {
  const profile = row.profiles;
  const brief = row.vehicle_briefs;
  const vehicle: AdminVehicleSummary | null = brief
    ? {
        city: brief.city,
        make: brief.make,
        model: brief.model,
        state: brief.state,
        yearMax: brief.year_max,
        yearMin: brief.year_min,
      }
    : null;

  return {
    amountCents: row.amount_cents,
    createdAt: row.created_at,
    currency: row.currency,
    customerEmail: row.customer_email,
    customerName: profile?.full_name ?? null,
    id: row.id,
    paymentStatus: row.payment_status,
    updatedAt: row.updated_at,
    vehicle,
    workflowStatus: row.workflow_status,
  };
}

type AdminPageProps = {
  searchParams?: Promise<
    Record<string, string | string[] | undefined>
  >;
};

export default async function AdminPage({
  searchParams = Promise.resolve({}),
}: AdminPageProps = {}) {
  if (!hasSupabaseConfiguration()) return null;

  await requireAdmin();
  const supabase = await createServerClient();
  const query = parseAdminQueueSearchParams(await searchParams);
  const [countsResult, pageResult] = await Promise.all([
    loadWorkflowCounts(supabase),
    loadAdminEngagementPage(supabase, query),
  ]);

  if (
    countsResult.error ||
    !countsResult.counts ||
    pageResult.error ||
    typeof pageResult.count !== "number"
  ) {
    return (
      <main id="admin-main" className="wrap admin-message">
        <span className="label">Operations</span>
        <h1 className="d2">The review queue is unavailable.</h1>
        <p className="lede">
          Refresh the page to try again. No customer records were changed.
        </p>
      </main>
    );
  }

  const engagements = (
    (pageResult.data ?? []) as unknown as RawQueueEngagement[]
  ).map(normalizeQueueEngagement);
  const pageCount = Math.max(
    1,
    Math.ceil(pageResult.count / ADMIN_QUEUE_PAGE_SIZE),
  );
  if (query.page > pageCount) {
    redirect(adminQueueHref(query, pageCount));
  }

  return (
    <AdminOverview
      counts={countsResult.counts}
      engagements={engagements}
      filteredCount={pageResult.count}
      pageCount={pageCount}
      query={query}
    />
  );
}
