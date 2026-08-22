import { redirect } from "next/navigation";

import { IntakeThread } from "@/components/onboarding/intake-thread";
import type { IntakeAnswers } from "@/components/onboarding/intake-questions";
import {
  normalizeRequestedEngagementId,
  selectCustomerEngagement,
} from "@/lib/domain/engagement-selection";
import { claimPaidEngagements } from "@/lib/supabase/claim";
import type { Json } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase/server";

type OnboardingPageProps = {
  searchParams: Promise<{
    engagement?: string | string[];
  }>;
};

function draftAnswers(value: Json | null | undefined): IntakeAnswers {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }
  return { ...value };
}

function finalizedBriefAnswers(
  brief: Tables<"vehicle_briefs"> | null,
): IntakeAnswers {
  if (!brief) {
    return {};
  }

  return {
    budgetCents: brief.budget_cents,
    city: brief.city,
    colors: brief.colors,
    condition: brief.condition,
    consent: brief.consent,
    dealBreakers: brief.deal_breakers,
    financingPreference: brief.financing_preference,
    hasTradeIn: brief.has_trade_in,
    make: brief.make,
    model: brief.model,
    notes: brief.notes,
    options: brief.options,
    postalCode: brief.postal_code,
    searchRadiusMiles: brief.search_radius_miles,
    state: brief.state,
    timeline: brief.timeline,
    tradeInDetails: brief.trade_in_details,
    trim: brief.trim,
    yearMax: brief.year_max,
    yearMin: brief.year_min,
  };
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  ) {
    return null;
  }

  const params = await searchParams;
  const requestedEngagementId = normalizeRequestedEngagementId(
    params.engagement,
  );
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.email || !user.email_confirmed_at) {
    const next = requestedEngagementId
      ? `/onboarding?engagement=${requestedEngagementId}`
      : "/onboarding";
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  try {
    await claimPaidEngagements(user.id, user.email);
  } catch {
    redirect("/portal?payment=processing");
  }

  const { data: visibleEngagements, error: engagementError } = await supabase
    .from("engagements")
    .select("created_at, id, payment_status, workflow_status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (engagementError) {
    return (
      <main className="setup-state">
        <div>
          <span className="label">Vehicle brief</span>
          <h1 className="d2">We could not load your saved brief.</h1>
          <p className="lede">Refresh the page to try again.</p>
        </div>
      </main>
    );
  }
  const engagement = selectCustomerEngagement(
    visibleEngagements ?? [],
    requestedEngagementId,
  );
  if (!engagement) {
    redirect("/portal");
  }
  const isEditable =
    engagement.payment_status === "paid" &&
    (engagement.workflow_status === "awaiting_brief" ||
      engagement.workflow_status === "brief_submitted");
  if (!isEditable) {
    redirect(`/portal?engagement=${engagement.id}`);
  }
  if (requestedEngagementId !== engagement.id) {
    redirect(`/onboarding?engagement=${engagement.id}`);
  }

  const [draftResult, briefResult] = await Promise.all([
    supabase
      .from("brief_drafts")
      .select("answers, current_question_id")
      .eq("engagement_id", engagement.id)
      .maybeSingle(),
    supabase
      .from("vehicle_briefs")
      .select("*")
      .eq("engagement_id", engagement.id)
      .maybeSingle(),
  ]);

  if (draftResult.error || briefResult.error) {
    return (
      <main className="setup-state">
        <div>
          <span className="label">Vehicle brief</span>
          <h1 className="d2">We could not load your saved answers.</h1>
          <p className="lede">Refresh the page to try again.</p>
        </div>
      </main>
    );
  }

  const isRevision = engagement.workflow_status === "brief_submitted";
  const initialDraft = draftResult.data
    ? draftAnswers(draftResult.data.answers)
    : finalizedBriefAnswers(briefResult.data);

  return (
    <main>
      <IntakeThread
        engagementId={engagement.id}
        initialDraft={initialDraft}
        initialQuestionId={
          draftResult.data?.current_question_id ??
          (isRevision ? "condition" : undefined)
        }
        revisionMode={isRevision}
      />
    </main>
  );
}
