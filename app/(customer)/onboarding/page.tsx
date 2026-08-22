import { redirect } from "next/navigation";

import { IntakeThread } from "@/components/onboarding/intake-thread";
import type { IntakeAnswers } from "@/components/onboarding/intake-questions";
import type { Json } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase/server";

function draftAnswers(value: Json | null | undefined): IntakeAnswers {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }
  return { ...value };
}

export default async function OnboardingPage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  ) {
    return null;
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/sign-in?next=%2Fonboarding");
  }

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id")
    .eq("user_id", user.id)
    .eq("payment_status", "paid")
    .eq("workflow_status", "awaiting_brief")
    .is("onboarding_completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
  if (!engagement) {
    redirect("/portal");
  }

  const { data: draft, error: draftError } = await supabase
    .from("brief_drafts")
    .select("answers, current_question_id")
    .eq("engagement_id", engagement.id)
    .maybeSingle();

  if (draftError) {
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

  return (
    <main>
      <IntakeThread
        engagementId={engagement.id}
        initialDraft={draftAnswers(draft?.answers)}
        initialQuestionId={draft?.current_question_id}
      />
    </main>
  );
}
