import { z } from "zod";

export const workflowStatuses = [
  "awaiting_brief",
  "brief_submitted",
  "in_review",
  "searching",
  "negotiating",
  "offers_ready",
  "completed",
  "cancelled",
] as const;

export const workflowStatusSchema = z.enum(workflowStatuses);

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

export const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(320);

export function normalizeEmail(email: string): string {
  return normalizedEmailSchema.parse(email);
}

const allowedTransitions: Record<
  WorkflowStatus,
  readonly WorkflowStatus[]
> = {
  awaiting_brief: ["cancelled"],
  brief_submitted: ["in_review", "cancelled"],
  in_review: ["searching", "cancelled"],
  searching: ["negotiating", "cancelled"],
  negotiating: ["searching", "offers_ready", "cancelled"],
  offers_ready: ["negotiating", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}
