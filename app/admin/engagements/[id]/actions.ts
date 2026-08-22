"use server";

import { revalidatePath } from "next/cache";

import {
  hasSupabaseConfiguration,
  requireAdmin,
} from "@/lib/auth/admin";
import {
  adminStatusUpdateSchema,
  validateTransition,
} from "@/lib/domain/admin-engagement";
import type { AdminStatusUpdateInput } from "@/lib/domain/admin-engagement";
import { workflowStatusSchema } from "@/lib/domain/engagement";
import { createServerClient } from "@/lib/supabase/server";

export type UpdateEngagementStatusResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateEngagementStatus(
  input: AdminStatusUpdateInput,
): Promise<UpdateEngagementStatusResult> {
  if (!hasSupabaseConfiguration()) {
    return {
      ok: false,
      error: "Admin access is not configured.",
    };
  }

  const parsed = adminStatusUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const copyMissing = parsed.error.issues.some(
      (issue) => issue.path[0] === "title" || issue.path[0] === "note",
    );
    return {
      ok: false,
      error: copyMissing
        ? "Add a title and a plain-language customer update."
        : "Check the engagement and next workflow status.",
    };
  }

  await requireAdmin();
  const supabase = await createServerClient();
  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("payment_status, workflow_status, vehicle_briefs(engagement_id)")
    .eq("id", parsed.data.engagementId)
    .maybeSingle();
  const currentStatus = workflowStatusSchema.safeParse(
    engagement?.workflow_status,
  );

  if (engagementError || !currentStatus.success) {
    return {
      ok: false,
      error: "We could not update that engagement. Refresh and try again.",
    };
  }

  if (engagement.payment_status !== "paid") {
    return {
      ok: false,
      error: "Only a paid engagement can receive workflow updates.",
    };
  }
  const hasBrief = Array.isArray(engagement.vehicle_briefs)
    ? engagement.vehicle_briefs.length > 0
    : Boolean(engagement.vehicle_briefs);
  if (parsed.data.nextStatus !== "cancelled" && !hasBrief) {
    return {
      ok: false,
      error: "A submitted vehicle brief is required for that workflow update.",
    };
  }

  try {
    validateTransition(currentStatus.data, parsed.data.nextStatus);
  } catch {
    return {
      ok: false,
      error: "That workflow change is not allowed from the current status.",
    };
  }

  const { data: updated, error: updateError } = await supabase.rpc(
    "update_engagement_status",
    {
      p_engagement_id: parsed.data.engagementId,
      p_next_status: parsed.data.nextStatus,
      p_note: parsed.data.note,
      p_title: parsed.data.title,
    },
  );

  if (updateError || updated !== true) {
    return {
      ok: false,
      error:
        "The workflow changed before this update was saved. Refresh and try again.",
    };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/engagements/${parsed.data.engagementId}`);
  return { ok: true };
}
