import Link from "next/link";

import { BriefSummary } from "./brief-summary";
import type { PortalBrief } from "./brief-summary";
import { StatusTimeline } from "./status-timeline";
import type { PortalStatusUpdate } from "./status-timeline";
import type { Tables } from "@/lib/supabase/database.types";

export type PortalEngagement = Pick<
  Tables<"engagements">,
  | "amount_cents"
  | "created_at"
  | "currency"
  | "id"
  | "payment_status"
  | "stripe_checkout_session_id"
  | "stripe_payment_intent_id"
  | "workflow_status"
>;

type PortalShellProps = {
  brief: PortalBrief | null;
  engagement: PortalEngagement;
  engagements: readonly PortalEngagement[];
  signOutAction?: () => void | Promise<void>;
  updates: readonly PortalStatusUpdate[];
};

type WorkflowStatus = PortalEngagement["workflow_status"];

const WORKFLOW_COPY: Record<
  WorkflowStatus,
  { label: string; nextStep: string }
> = {
  awaiting_brief: {
    label: "Awaiting brief",
    nextStep:
      "Complete your vehicle brief so your buying agent can begin the review.",
  },
  brief_submitted: {
    label: "Brief submitted",
    nextStep:
      "Your buying agent will review your brief before starting the vehicle search.",
  },
  cancelled: {
    label: "Engagement closed",
    nextStep:
      "No further work is scheduled. Contact support if you believe this is incorrect.",
  },
  completed: {
    label: "Search complete",
    nextStep:
      "Your engagement is complete. Keep this page and its updates for your records.",
  },
  in_review: {
    label: "Brief in review",
    nextStep:
      "Your buying agent is reviewing the brief. We will post an update when the search begins.",
  },
  negotiating: {
    label: "Negotiating",
    nextStep:
      "Your buying agent is negotiating from your brief. We will post the outcome when it is confirmed.",
  },
  offers_ready: {
    label: "Offers ready",
    nextStep:
      "Your buying agent has offers ready. Follow the instructions in the latest update.",
  },
  searching: {
    label: "Vehicle search",
    nextStep:
      "Your buying agent is searching against your brief. Verified progress will be posted here.",
  },
};

function engagementCopy(
  engagement: Pick<PortalEngagement, "payment_status" | "workflow_status">,
): { label: string; nextStep: string } {
  if (engagement.payment_status === "refunded") {
    return {
      label: "Payment refunded",
      nextStep:
        "The service fee was refunded. No further work is scheduled for this engagement.",
    };
  }
  if (engagement.payment_status === "failed") {
    return {
      label: "Payment not completed",
      nextStep:
        "Payment was not completed, so no vehicle search has started for this engagement.",
    };
  }
  if (engagement.payment_status === "pending") {
    return {
      label: "Payment pending",
      nextStep:
        "Payment has not been confirmed. No vehicle search will begin unless payment is completed.",
    };
  }
  return WORKFLOW_COPY[engagement.workflow_status];
}

function formatPaymentAmount(
  amountCents: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`;
  }
}

function paymentStatusLabel(
  status: PortalEngagement["payment_status"],
): string {
  return (
    {
      failed: "Failed",
      paid: "Paid",
      pending: "Pending",
      refunded: "Refunded",
    } as const
  )[status];
}

function formatEngagementDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function PortalShell({
  brief,
  engagement,
  engagements,
  signOutAction,
  updates,
}: PortalShellProps) {
  const workflow = engagementCopy(engagement);
  const paymentReference =
    engagement.stripe_checkout_session_id ??
    engagement.stripe_payment_intent_id;

  return (
    <div className="portal">
      <a className="skip" href="#portal-main">
        Skip to portal content
      </a>
      <header className="portal-header">
        <div className="wrap portal-header__inner">
          <Link
            className="portal-brand"
            href="/"
            aria-label="CarBuyerBots home"
          >
            CarBuyerBots
          </Link>
          <form action={signOutAction}>
            <button className="portal-signout" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main id="portal-main">
        <nav
          className="wrap portal-switcher"
          aria-label="Your engagements"
        >
          <span className="label">Your vehicle searches</span>
          <ul>
            {engagements.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/portal?engagement=${item.id}`}
                  aria-current={item.id === engagement.id ? "page" : undefined}
                >
                  <span>{engagementCopy(item).label}</span>
                  <time dateTime={item.created_at}>
                    {formatEngagementDate(item.created_at)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section className="wrap portal-overview" aria-labelledby="portal-title">
          <div className="portal-overview__stage">
            <span className="label">Current stage</span>
            <h1 className="d2" id="portal-title">
              {workflow.label}
            </h1>
          </div>
          <div className="portal-overview__next">
            <span className="label">What happens next</span>
            <p className="lede">{workflow.nextStep}</p>
          </div>
        </section>

        <div className="wrap portal-record">
          <section
            className="portal-payment"
            aria-labelledby="portal-payment-title"
          >
            <div className="portal-section-heading">
              <span className="label">Payment record</span>
              <h2 className="d3" id="portal-payment-title">
                Service fee
              </h2>
            </div>
            <dl className="portal-payment__details">
              <div>
                <dt>Amount</dt>
                <dd className="money num">
                  {formatPaymentAmount(
                    engagement.amount_cents,
                    engagement.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{paymentStatusLabel(engagement.payment_status)}</dd>
              </div>
              <div>
                <dt>Payment reference</dt>
                <dd className="portal-reference">
                  {paymentReference ?? "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Engagement reference</dt>
                <dd className="portal-reference">{engagement.id}</dd>
              </div>
            </dl>
          </section>

          <BriefSummary
            brief={brief}
            engagementId={engagement.id}
            paymentStatus={engagement.payment_status}
            workflowStatus={engagement.workflow_status}
          />
          <StatusTimeline updates={updates} />
        </div>
      </main>
    </div>
  );
}
