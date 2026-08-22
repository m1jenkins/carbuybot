import type { Tables } from "@/lib/supabase/database.types";
import { z } from "zod";

type SelectableEngagement = Pick<
  Tables<"engagements">,
  "created_at" | "id" | "payment_status" | "workflow_status"
>;

const engagementIdSchema = z.uuid();

export function normalizeRequestedEngagementId(
  value: string | string[] | undefined,
): string | null {
  const requested = Array.isArray(value) ? value[0] : value;
  const parsed = engagementIdSchema.safeParse(requested);
  return parsed.success ? parsed.data : null;
}

function isTerminal(status: SelectableEngagement["workflow_status"]): boolean {
  return status === "completed" || status === "cancelled";
}

function isPaidActionable(engagement: SelectableEngagement): boolean {
  return (
    engagement.payment_status === "paid" &&
    !isTerminal(engagement.workflow_status)
  );
}

export function orderCustomerEngagements<T extends SelectableEngagement>(
  engagements: readonly T[],
): T[] {
  return [...engagements].sort((first, second) => {
    const actionabilityDifference =
      Number(!isPaidActionable(first)) - Number(!isPaidActionable(second));
    if (actionabilityDifference !== 0) {
      return actionabilityDifference;
    }

    const terminalDifference =
      Number(isTerminal(first.workflow_status)) -
      Number(isTerminal(second.workflow_status));
    if (terminalDifference !== 0) {
      return terminalDifference;
    }

    const createdDifference =
      new Date(second.created_at).getTime() -
      new Date(first.created_at).getTime();
    if (createdDifference !== 0) {
      return createdDifference;
    }

    return first.id.localeCompare(second.id);
  });
}

export function selectCustomerEngagement<T extends SelectableEngagement>(
  engagements: readonly T[],
  requestedId?: string | null,
): T | null {
  if (requestedId) {
    const requested = engagements.find(
      (engagement) => engagement.id === requestedId,
    );
    if (requested) {
      return requested;
    }
  }

  return orderCustomerEngagements(engagements)[0] ?? null;
}
