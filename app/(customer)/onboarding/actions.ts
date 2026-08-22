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

  const currentQuestionId = getNextQuestionId(
    { [input.questionId]: normalized },
    input.questionId,
  );
  const { error: saveError } = await supabase.rpc("save_brief_answer", {
    p_current_question_id: currentQuestionId,
    p_engagement_id: engagementId.data,
    p_question_id: input.questionId,
    p_value: normalized as Json,
  });

  if (saveError) {
    if (
      input.questionId === "yearMin" ||
      input.questionId === "yearMax"
    ) {
      if (
        saveError.message
          .toLowerCase()
          .includes("minimum year cannot be later than maximum year")
      ) {
        return {
          ok: false,
          error: "Minimum year cannot be later than maximum year.",
        };
      }
    }
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

  try {
    buildBriefFromAnswers(answers);
  } catch {
    return {
      ok: false,
      error: "Your brief is incomplete. Review the unanswered questions.",
    };
  }

  try {
    const admin = createAdminClient();
    const { error: finalizeError } = await admin.rpc(
      "finalize_vehicle_brief",
      {
        p_engagement_id: engagementId.data,
        p_user_id: user.id,
      },
    );

    if (finalizeError) {
      return {
        ok: false,
        error: "We could not submit your brief. Your answers are still saved.",
      };
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("SUPABASE_SERVICE_ROLE_KEY")
    ) {
      return {
        ok: false,
        error:
          "Secure submission is not configured. Your answers are saved; contact support before trying again.",
      };
    }
    return {
      ok: false,
      error: "We could not submit your brief. Your answers are still saved.",
    };
  }

  return { ok: true };
}
