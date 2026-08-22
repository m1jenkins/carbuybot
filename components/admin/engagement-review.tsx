"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  getAllowedTransitions,
  workflowLabels,
} from "@/lib/domain/admin-engagement";
import type { WorkflowStatus } from "@/lib/domain/engagement";

import type {
  AdminBrief,
  AdminEngagementDetail,
  AdminStatusUpdate,
} from "./types";

type StatusActionResult = { ok: true } | { ok: false; error: string };

type EngagementReviewProps = {
  brief: AdminBrief | null;
  engagement: AdminEngagementDetail;
  historyPage: number;
  historyPageCount: number;
  historyTotal: number;
  statusAction: (input: {
    engagementId: string;
    nextStatus: WorkflowStatus;
    note: string;
    title: string;
  }) => Promise<StatusActionResult>;
  updates: readonly AdminStatusUpdate[];
};

const paymentLabels: Record<
  AdminEngagementDetail["paymentStatus"],
  string
> = {
  failed: "Failed",
  paid: "Paid",
  pending: "Pending",
  refunded: "Refunded",
};

function formatAmount(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      currency: currency.toUpperCase(),
      style: "currency",
    }).format(amountCents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`;
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function sentenceCase(value: string): string {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function listValue(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "None specified";
}

function vehicleTitle(
  engagement: AdminEngagementDetail,
  brief: AdminBrief | null,
): string {
  if (!brief) return "Vehicle brief not submitted";
  const years =
    brief.yearMin && brief.yearMax
      ? brief.yearMin === brief.yearMax
        ? `${brief.yearMin}`
        : `${brief.yearMin}–${brief.yearMax}`
      : brief.yearMin
        ? `${brief.yearMin}+`
        : brief.yearMax
          ? `Up to ${brief.yearMax}`
          : "";
  return [years, brief.make, brief.model, brief.trim]
    .filter(Boolean)
    .join(" ");
}

function historyPageHref(engagementId: string, page: number): string {
  return `/admin/engagements/${engagementId}?historyPage=${page}#admin-history-title`;
}

export function EngagementReview({
  brief,
  engagement,
  historyPage,
  historyPageCount,
  historyTotal,
  statusAction,
  updates,
}: EngagementReviewProps) {
  const nextStatuses = getAllowedTransitions(engagement.workflowStatus);
  const [result, formAction, pending] = useActionState<
    StatusActionResult | null,
    FormData
  >(async (_previous, formData) => {
    return statusAction({
      engagementId: engagement.id,
      nextStatus: formData.get("nextStatus") as WorkflowStatus,
      note: String(formData.get("note") ?? ""),
      title: String(formData.get("title") ?? ""),
    });
  }, null);

  return (
    <main id="admin-main" className="admin-main">
      <section className="wrap admin-review-head">
        <Link className="tlink" href="/admin">
          <span aria-hidden="true">←</span> Return to queue
        </Link>
        <div className="admin-review-head__title">
          <div>
            <span className="label">Engagement review</span>
            <h1 className="d2">{vehicleTitle(engagement, brief)}</h1>
          </div>
          <div className="admin-current-status">
            <span className="label">Current workflow</span>
            <strong>{workflowLabels[engagement.workflowStatus]}</strong>
          </div>
        </div>
      </section>

      <div className="wrap admin-review">
        <section aria-labelledby="admin-customer-title">
          <div className="admin-section-heading">
            <div>
              <span className="label">Customer record</span>
              <h2 className="d3" id="admin-customer-title">
                Customer and engagement
              </h2>
            </div>
          </div>
          <dl className="admin-detail-grid">
            <div>
              <dt>Customer</dt>
              <dd>{engagement.customerName ?? "Name unavailable"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{engagement.customerEmail}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>
                <time dateTime={engagement.createdAt}>
                  {formatDate(engagement.createdAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Last workflow update</dt>
              <dd>
                <time dateTime={engagement.updatedAt}>
                  {formatDate(engagement.updatedAt)}
                </time>
              </dd>
            </div>
            <div className="admin-detail-grid__wide">
              <dt>Engagement reference</dt>
              <dd className="admin-reference">{engagement.id}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="admin-payment-title">
          <div className="admin-section-heading">
            <div>
              <span className="label">Payment record</span>
              <h2 className="d3" id="admin-payment-title">
                Service fee
              </h2>
            </div>
          </div>
          <dl className="admin-detail-grid">
            <div>
              <dt>Amount</dt>
              <dd className="money admin-amount">
                {formatAmount(engagement.amountCents, engagement.currency)}
              </dd>
            </div>
            <div>
              <dt>Payment status</dt>
              <dd
                className={
                  engagement.paymentStatus === "paid" ? "money" : undefined
                }
              >
                {paymentLabels[engagement.paymentStatus]}
              </dd>
            </div>
            <div>
              <dt>Checkout session</dt>
              <dd className="admin-reference">
                {engagement.stripeCheckoutSessionId ?? "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Payment intent</dt>
              <dd className="admin-reference">
                {engagement.stripePaymentIntentId ?? "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Stripe customer</dt>
              <dd className="admin-reference">
                {engagement.stripeCustomerId ?? "Unavailable"}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="admin-brief-title">
          <div className="admin-section-heading">
            <div>
              <span className="label">Customer brief</span>
              <h2 className="d3" id="admin-brief-title">
                Complete search criteria
              </h2>
            </div>
          </div>
          {brief ? (
            <dl className="admin-detail-grid">
              <div>
                <dt>Condition</dt>
                <dd>{sentenceCase(brief.condition)}</dd>
              </div>
              <div>
                <dt>Vehicle</dt>
                <dd>{vehicleTitle(engagement, brief)}</dd>
              </div>
              <div>
                <dt>Colors</dt>
                <dd>{listValue(brief.colors)}</dd>
              </div>
              <div>
                <dt>Required options</dt>
                <dd>{listValue(brief.options)}</dd>
              </div>
              <div>
                <dt>Deal breakers</dt>
                <dd>{listValue(brief.dealBreakers)}</dd>
              </div>
              <div>
                <dt>Vehicle budget</dt>
                <dd className="money">
                  {formatAmount(brief.budgetCents, engagement.currency)}
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {brief.city}, {brief.state} {brief.postalCode}
                </dd>
              </div>
              <div>
                <dt>Search radius</dt>
                <dd>{brief.searchRadiusMiles} miles</dd>
              </div>
              <div>
                <dt>Timeline</dt>
                <dd>{sentenceCase(brief.timeline)}</dd>
              </div>
              <div>
                <dt>Financing</dt>
                <dd>{sentenceCase(brief.financingPreference)}</dd>
              </div>
              <div>
                <dt>Trade-in</dt>
                <dd>
                  {brief.hasTradeIn
                    ? (brief.tradeInDetails ?? "Details not provided")
                    : "No trade-in"}
                </dd>
              </div>
              <div>
                <dt>Consent</dt>
                <dd>{brief.consent ? "Consent recorded" : "Not recorded"}</dd>
              </div>
              <div className="admin-detail-grid__wide">
                <dt>Additional notes</dt>
                <dd>{brief.notes ?? "None provided"}</dd>
              </div>
              <div>
                <dt>Brief created</dt>
                <dd>
                  <time dateTime={brief.createdAt}>
                    {formatDate(brief.createdAt)}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Brief updated</dt>
                <dd>
                  <time dateTime={brief.updatedAt}>
                    {formatDate(brief.updatedAt)}
                  </time>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="admin-empty">
              No vehicle brief has been submitted for this engagement.
            </p>
          )}
        </section>

        <section aria-labelledby="admin-history-title">
          <div className="admin-section-heading">
            <div>
              <span className="label">Audit trail</span>
              <h2 className="d3" id="admin-history-title">
                Status history
              </h2>
            </div>
            <p className="cap">
              {historyTotal.toLocaleString("en-US")} updates total
            </p>
          </div>
          {updates.length > 0 ? (
            <ol
              className="admin-history"
              aria-label={`Status history page ${historyPage}`}
            >
              {updates.map((update) => (
                <li key={update.id}>
                  <div>
                    <time dateTime={update.createdAt}>
                      {formatDate(update.createdAt)}
                    </time>
                    <span>
                      {update.customerVisible
                        ? "Customer visible"
                        : "Internal record"}
                    </span>
                  </div>
                  <div>
                    <h3>{update.title}</h3>
                    <p>{update.note}</p>
                    <small>{workflowLabels[update.status]}</small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="admin-empty">No status activity has been recorded.</p>
          )}
          {historyPageCount > 1 ? (
            <nav className="admin-pagination" aria-label="Status history pages">
              {historyPage > 1 ? (
                <Link
                  href={historyPageHref(engagement.id, historyPage - 1)}
                >
                  Return to newer updates
                </Link>
              ) : (
                <span aria-disabled="true">Return to newer updates</span>
              )}
              <span aria-current="page">
                Page {historyPage.toLocaleString("en-US")} of{" "}
                {historyPageCount.toLocaleString("en-US")}
              </span>
              {historyPage < historyPageCount ? (
                <Link
                  href={historyPageHref(engagement.id, historyPage + 1)}
                >
                  Load older updates
                </Link>
              ) : (
                <span aria-disabled="true">Load older updates</span>
              )}
            </nav>
          ) : null}
        </section>

        <section aria-labelledby="admin-update-title">
          <div className="admin-section-heading">
            <div>
              <span className="label">Controlled update</span>
              <h2 className="d3" id="admin-update-title">
                Post the next verified status
              </h2>
            </div>
            <p className="cap">
              The title and note are shown to the customer. Use plain,
              confirmed facts only.
            </p>
          </div>

          {nextStatuses.length > 0 ? (
            <form action={formAction} className="admin-status-form">
              <label>
                <span>Next workflow status</span>
                <select name="nextStatus" required defaultValue="">
                  <option value="" disabled>
                    Select the confirmed next status
                  </option>
                  {nextStatuses.map((status) => (
                    <option key={status} value={status}>
                      {workflowLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Customer-visible title</span>
                <input
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="What changed"
                />
              </label>
              <label className="admin-status-form__note">
                <span>Customer-visible note</span>
                <textarea
                  name="note"
                  required
                  maxLength={5_000}
                  rows={5}
                  placeholder="State what is confirmed and what happens next."
                />
              </label>
              <div className="admin-status-form__submit">
                <button
                  className="admin-action"
                  type="submit"
                  disabled={pending}
                >
                  {pending ? "Saving update…" : "Save customer update"}
                </button>
                <div aria-live="polite">
                  {result?.ok ? (
                    <p className="admin-form-success">
                      The workflow and customer update were saved together.
                    </p>
                  ) : result ? (
                    <p className="admin-form-error" role="alert">
                      {result.error}
                    </p>
                  ) : null}
                </div>
              </div>
            </form>
          ) : (
            <p className="admin-empty">
              This engagement is in a terminal workflow state. No further
              status transition is available.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
