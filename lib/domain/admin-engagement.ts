import { z } from "zod";

import {
  canTransition,
  workflowStatuses,
  workflowStatusSchema,
} from "./engagement";
import type { WorkflowStatus } from "./engagement";

export const adminStatusUpdateSchema = z
  .object({
    engagementId: z.uuid(),
    nextStatus: workflowStatusSchema,
    title: z.string().trim().min(1).max(200),
    note: z.string().trim().min(1).max(5_000),
  })
  .strict();

export type AdminStatusUpdateInput = z.input<typeof adminStatusUpdateSchema>;

export type AdminTransitionContext = {
  hasBrief: boolean;
  paymentStatus: "failed" | "paid" | "pending" | "refunded";
};

export const workflowLabels: Record<WorkflowStatus, string> = {
  awaiting_brief: "Awaiting brief",
  brief_submitted: "Needs review",
  in_review: "Brief in review",
  searching: "Vehicle search",
  negotiating: "Negotiating",
  offers_ready: "Offers ready",
  completed: "Complete",
  cancelled: "Closed",
};

export function validateTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
  context: AdminTransitionContext,
): void {
  if (
    context.paymentStatus !== "paid" ||
    (to !== "cancelled" && !context.hasBrief) ||
    !canTransition(from, to)
  ) {
    throw new Error("That workflow transition is not allowed.");
  }
}

export function getAllowedTransitions(
  from: WorkflowStatus,
  context: AdminTransitionContext,
): WorkflowStatus[] {
  return workflowStatuses.filter((status) => {
    try {
      validateTransition(from, status, context);
      return true;
    } catch {
      return false;
    }
  });
}
