import { AdminOverview } from "@/components/admin/admin-overview";
import type {
  AdminQueueEngagement,
  AdminVehicleSummary,
} from "@/components/admin/types";
import {
  hasSupabaseConfiguration,
  requireAdmin,
} from "@/lib/auth/admin";
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

export default async function AdminPage() {
  if (!hasSupabaseConfiguration()) return null;

  await requireAdmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("engagements")
    .select(
      "amount_cents, created_at, currency, customer_email, id, payment_status, updated_at, workflow_status, profiles!engagements_user_id_fkey(full_name), vehicle_briefs(city, make, model, state, year_max, year_min)",
    )
    .order("created_at", { ascending: false });

  if (error) {
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

  const engagements = ((data ?? []) as unknown as RawQueueEngagement[]).map(
    normalizeQueueEngagement,
  );
  return <AdminOverview engagements={engagements} />;
}
