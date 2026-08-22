import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { EngagementReview } from "@/components/admin/engagement-review";
import type {
  AdminBrief,
  AdminEngagementDetail,
  AdminStatusUpdate,
} from "@/components/admin/types";
import {
  hasSupabaseConfiguration,
  requireAdmin,
} from "@/lib/auth/admin";
import {
  ADMIN_HISTORY_PAGE_SIZE,
  parseAdminHistorySearchParams,
} from "@/lib/domain/admin-query";
import type { Tables } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase/server";

import { updateEngagementStatus } from "./actions";

type EngagementPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<
    Record<string, string | string[] | undefined>
  >;
};

type RawDetailEngagement = Pick<
  Tables<"engagements">,
  | "amount_cents"
  | "created_at"
  | "currency"
  | "customer_email"
  | "id"
  | "onboarding_completed_at"
  | "payment_status"
  | "stripe_checkout_session_id"
  | "stripe_customer_id"
  | "stripe_payment_intent_id"
  | "updated_at"
  | "workflow_status"
> & {
  profiles: { full_name: string | null } | null;
};

function normalizeEngagement(
  row: RawDetailEngagement,
  brief: AdminBrief | null,
): AdminEngagementDetail {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    amountCents: row.amount_cents,
    createdAt: row.created_at,
    currency: row.currency,
    customerEmail: row.customer_email,
    customerName: profile?.full_name ?? null,
    id: row.id,
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    paymentStatus: row.payment_status,
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    stripeCustomerId: row.stripe_customer_id ?? null,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    updatedAt: row.updated_at,
    vehicle: brief
      ? {
          city: brief.city,
          make: brief.make,
          model: brief.model,
          state: brief.state,
          yearMax: brief.yearMax,
          yearMin: brief.yearMin,
        }
      : null,
    workflowStatus: row.workflow_status,
  };
}

function normalizeBrief(row: Tables<"vehicle_briefs">): AdminBrief {
  return {
    budgetCents: row.budget_cents,
    city: row.city,
    colors: row.colors,
    condition: row.condition,
    consent: row.consent,
    createdAt: row.created_at,
    dealBreakers: row.deal_breakers,
    financingPreference: row.financing_preference,
    hasTradeIn: row.has_trade_in,
    make: row.make,
    model: row.model,
    notes: row.notes,
    options: row.options,
    postalCode: row.postal_code,
    searchRadiusMiles: row.search_radius_miles,
    state: row.state,
    timeline: row.timeline,
    tradeInDetails: row.trade_in_details,
    trim: row.trim,
    updatedAt: row.updated_at,
    yearMax: row.year_max,
    yearMin: row.year_min,
  };
}

function normalizeUpdate(row: Tables<"status_updates">): AdminStatusUpdate {
  return {
    authorId: row.author_id,
    createdAt: row.created_at,
    customerVisible: row.customer_visible,
    id: row.id,
    note: row.note,
    status: row.status,
    title: row.title,
  };
}

export default async function EngagementPage({
  params,
  searchParams = Promise.resolve({}),
}: EngagementPageProps) {
  if (!hasSupabaseConfiguration()) return null;

  const route = z.object({ id: z.uuid() }).safeParse(await params);
  if (!route.success) notFound();
  const { historyPage } = parseAdminHistorySearchParams(await searchParams);
  const historyFrom = (historyPage - 1) * ADMIN_HISTORY_PAGE_SIZE;

  await requireAdmin();
  const supabase = await createServerClient();
  const [engagementResult, briefResult, updatesResult] = await Promise.all([
    supabase
      .from("engagements")
      .select(
        "amount_cents, created_at, currency, customer_email, id, onboarding_completed_at, payment_status, stripe_checkout_session_id, stripe_customer_id, stripe_payment_intent_id, updated_at, workflow_status, profiles!engagements_user_id_fkey(full_name)",
      )
      .eq("id", route.data.id)
      .maybeSingle(),
    supabase
      .from("vehicle_briefs")
      .select(
        "budget_cents, city, colors, condition, consent, created_at, deal_breakers, engagement_id, financing_preference, has_trade_in, make, model, notes, options, postal_code, search_radius_miles, state, timeline, trade_in_details, trim, updated_at, year_max, year_min",
      )
      .eq("engagement_id", route.data.id)
      .maybeSingle(),
    supabase
      .from("status_updates")
      .select(
        "author_id, created_at, customer_visible, engagement_id, id, note, status, title",
        { count: "exact" },
      )
      .eq("engagement_id", route.data.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(historyFrom, historyFrom + ADMIN_HISTORY_PAGE_SIZE - 1),
  ]);

  if (engagementResult.error || !engagementResult.data) {
    notFound();
  }

  if (
    briefResult.error ||
    updatesResult.error ||
    typeof updatesResult.count !== "number"
  ) {
    return (
      <main id="admin-main" className="wrap admin-message">
        <span className="label">Engagement review</span>
        <h1 className="d2">This record is temporarily unavailable.</h1>
        <p className="lede">
          Refresh the page to try again. No workflow update was made.
        </p>
      </main>
    );
  }

  const brief = briefResult.data
    ? normalizeBrief(briefResult.data as Tables<"vehicle_briefs">)
    : null;
  const engagement = normalizeEngagement(
    engagementResult.data as unknown as RawDetailEngagement,
    brief,
  );
  const updates = (updatesResult.data ?? []).map((update) =>
    normalizeUpdate(update as Tables<"status_updates">),
  );
  const historyPageCount = Math.max(
    1,
    Math.ceil(updatesResult.count / ADMIN_HISTORY_PAGE_SIZE),
  );
  if (historyPage > historyPageCount) {
    redirect(
      `/admin/engagements/${route.data.id}?historyPage=${historyPageCount}#admin-history-title`,
    );
  }

  return (
    <EngagementReview
      brief={brief}
      engagement={engagement}
      historyPage={historyPage}
      historyPageCount={historyPageCount}
      historyTotal={updatesResult.count}
      statusAction={updateEngagementStatus}
      updates={updates}
    />
  );
}
