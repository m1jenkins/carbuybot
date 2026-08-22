"use server";

import { z } from "zod";

import {
  buildBriefFromAnswers,
  getNextQuestionId,
  isIntakeComplete,
  parseIntakeAnswer,
} from "@/components/onboarding/intake-questions";
import type { IntakeAnswers } from "@/components/onboarding/intake-questions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase/server";

const engagementIdSchema = z.uuid();

type SaveAnswerInput = {
  engagementId: string;
  questionId: string;
  value: unknown;
};

export type SaveAnswerResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

type SubmitBriefInput = {
  engagementId: string;
};

export type SubmitBriefResult =
  | { ok: true }
  | { ok: false; error: string };

function asAnswers(value: Json | undefined): IntakeAnswers {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }
  return { ...value };
}

async function getAuthenticatedUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email || !user.email_confirmed_at) {
    return { supabase, user: null };
  }
  return { supabase, user };
}

export async function saveAnswer(
  input: SaveAnswerInput,
): Promise<SaveAnswerResult> {
  const engagementId = engagementIdSchema.safeParse(input.engagementId);
  if (!engagementId.success) {
    return { ok: false, error: "That vehicle search is not valid." };
  }

  let normalized: unknown;
  try {
    normalized = parseIntakeAnswer(input.questionId, input.value);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Check this answer and try again.",
    };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return {
      ok: false,
      error: "Sign in again before saving your answer.",
    };
  }

  const { data: draft, error: readError } = await supabase
    .from("brief_drafts")
    .select("answers")
    .eq("engagement_id", engagementId.data)
    .maybeSingle();

  if (readError) {
    return {
      ok: false,
      error: "We could not load your saved answers. Try again.",
    };
  }

  const answers: IntakeAnswers = {
    ...asAnswers(draft?.answers),
    [input.questionId]: normalized,
  };
  const currentQuestionId = getNextQuestionId(answers, input.questionId);
  const { error: saveError } = await supabase.from("brief_drafts").upsert(
    {
      engagement_id: engagementId.data,
      answers: answers as Json,
      current_question_id: currentQuestionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "engagement_id" },
  );

  if (saveError) {
    return {
      ok: false,
      error: "We could not save that answer. Try again.",
    };
  }

  return { ok: true, value: normalized };
}

export async function submitBrief(
  input: SubmitBriefInput,
): Promise<SubmitBriefResult> {
  const engagementId = engagementIdSchema.safeParse(input.engagementId);
  if (!engagementId.success) {
    return { ok: false, error: "That vehicle search is not valid." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return {
      ok: false,
      error: "Sign in again before submitting your brief.",
    };
  }

  const { data: draft, error: draftError } = await supabase
    .from("brief_drafts")
    .select("answers")
    .eq("engagement_id", engagementId.data)
    .maybeSingle();
  const answers = asAnswers(draft?.answers);

  if (draftError || !draft || !isIntakeComplete(answers)) {
    return {
      ok: false,
      error: "Your brief is incomplete. Review the unanswered questions.",
    };
  }

  let brief;
  try {
    brief = buildBriefFromAnswers(answers);
  } catch {
    return {
      ok: false,
      error: "Your brief is incomplete. Review the unanswered questions.",
    };
  }

  const admin = createAdminClient();
  const { error: finalizeError } = await admin.rpc("finalize_vehicle_brief", {
    p_engagement_id: engagementId.data,
    p_user_id: user.id,
    p_brief: {
      budget_cents: brief.budgetCents,
      city: brief.city,
      colors: brief.colors,
      condition: brief.condition,
      consent: brief.consent,
      deal_breakers: brief.dealBreakers,
      financing_preference: brief.financingPreference,
      has_trade_in: brief.hasTradeIn,
      make: brief.make,
      model: brief.model,
      notes: brief.notes ?? null,
      options: brief.options,
      postal_code: brief.postalCode,
      search_radius_miles: brief.searchRadiusMiles,
      state: brief.state,
      timeline: brief.timeline,
      trade_in_details: brief.tradeInDetails ?? null,
      trim: brief.trim ?? null,
      year_max: brief.yearMax ?? null,
      year_min: brief.yearMin ?? null,
    },
  });

  if (finalizeError) {
    return {
      ok: false,
      error: "We could not submit your brief. Your answers are still saved.",
    };
  }

  return { ok: true };
}
