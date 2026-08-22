import Link from "next/link";

import type { Tables } from "@/lib/supabase/database.types";

export type PortalBrief = Pick<
  Tables<"vehicle_briefs">,
  | "budget_cents"
  | "city"
  | "colors"
  | "condition"
  | "deal_breakers"
  | "financing_preference"
  | "has_trade_in"
  | "make"
  | "model"
  | "notes"
  | "options"
  | "postal_code"
  | "search_radius_miles"
  | "state"
  | "timeline"
  | "trade_in_details"
  | "trim"
  | "year_max"
  | "year_min"
>;

type WorkflowStatus = Tables<"engagements">["workflow_status"];

type BriefSummaryProps = {
  brief: PortalBrief | null;
  engagementId: string;
  paymentStatus: Tables<"engagements">["payment_status"];
  workflowStatus: WorkflowStatus;
};

const TIMELINE_LABELS: Record<PortalBrief["timeline"], string> = {
  flexible: "Flexible",
  immediately: "Immediately",
  within_30_days: "Within 30 days",
  within_60_days: "Within 60 days",
  within_90_days: "Within 90 days",
};

const FINANCING_LABELS: Record<
  PortalBrief["financing_preference"],
  string
> = {
  cash: "Cash",
  lease: "Lease",
  loan: "Finance with a loan",
  undecided: "Not decided",
};

function yearDescription(brief: PortalBrief): string | null {
  if (brief.year_min && brief.year_max) {
    return brief.year_min === brief.year_max
      ? String(brief.year_min)
      : `${brief.year_min}–${brief.year_max}`;
  }
  if (brief.year_min) {
    return `${brief.year_min} or newer`;
  }
  if (brief.year_max) {
    return `${brief.year_max} or older`;
  }
  return null;
}

function vehicleName(brief: PortalBrief): string {
  return [yearDescription(brief), brief.make, brief.model]
    .filter(Boolean)
    .join(" ");
}

function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

function listOrFallback(values: readonly string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

export function BriefSummary({
  brief,
  engagementId,
  paymentStatus,
  workflowStatus,
}: BriefSummaryProps) {
  const canEdit =
    paymentStatus === "paid" &&
    (workflowStatus === "awaiting_brief" ||
      workflowStatus === "brief_submitted");

  if (!brief) {
    return (
      <section
        className="portal-brief"
        aria-labelledby="portal-brief-title"
      >
        <div className="portal-section-heading">
          <span className="label">Vehicle brief</span>
          <h2 className="d3" id="portal-brief-title">
            Not submitted yet
          </h2>
        </div>
        <p className="portal-empty-copy">
          Vehicle details will appear after you submit your brief.
        </p>
        {canEdit && (
          <Link
            className="tlink"
            href={`/onboarding?engagement=${engagementId}`}
          >
            Complete brief <span aria-hidden="true">→</span>
          </Link>
        )}
      </section>
    );
  }

  const details = [
    {
      label: "Condition",
      value:
        brief.condition === "either"
          ? "New or used"
          : brief.condition === "new"
            ? "New"
            : "Used",
    },
    { label: "Trim", value: brief.trim ?? "No preference" },
    {
      label: "Colors",
      value: listOrFallback(brief.colors, "No preference"),
    },
    {
      label: "Must-haves",
      value: listOrFallback(brief.options, "No must-haves"),
    },
    {
      label: "Deal-breakers",
      value: listOrFallback(brief.deal_breakers, "None"),
    },
    {
      label: "Search area",
      value: `${brief.city}, ${brief.state} ${brief.postal_code} · ${brief.search_radius_miles} miles`,
    },
    { label: "Timing", value: TIMELINE_LABELS[brief.timeline] },
    {
      label: "Payment plan",
      value: FINANCING_LABELS[brief.financing_preference],
    },
    {
      label: "Trade-in",
      value: brief.has_trade_in
        ? (brief.trade_in_details ?? "Trade-in details pending")
        : "No trade-in",
    },
    { label: "Notes", value: brief.notes ?? "Nothing else noted" },
  ];

  return (
    <section className="portal-brief" aria-labelledby="portal-brief-title">
      <div className="portal-section-heading portal-section-heading--action">
        <div>
          <span className="label">Vehicle brief</span>
          <h2 className="d3" id="portal-brief-title">
            {vehicleName(brief)}
          </h2>
        </div>
        {canEdit && (
          <Link
            className="tlink"
            href={`/onboarding?engagement=${engagementId}`}
          >
            Revise brief <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>

      <dl className="portal-brief__details">
        <div>
          <dt>Vehicle budget</dt>
          <dd className="money num">{formatMoney(brief.budget_cents)}</dd>
        </div>
        {details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
