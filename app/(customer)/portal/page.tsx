import Link from "next/link";
import { redirect } from "next/navigation";

import { PortalShell } from "@/components/portal/portal-shell";
import {
  normalizeRequestedEngagementId,
  orderCustomerEngagements,
  selectCustomerEngagement,
} from "@/lib/domain/engagement-selection";
import { claimPaidEngagements } from "@/lib/supabase/claim";
import { createServerClient } from "@/lib/supabase/server";

type PortalPageProps = {
  searchParams: Promise<{
    engagement?: string | string[];
    payment?: string | string[];
  }>;
};

function hasSupabaseConfiguration(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

async function signOut() {
  "use server";

  if (!hasSupabaseConfiguration()) {
    redirect("/sign-in");
  }

  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

function SetupState() {
  return (
    <main className="setup-state">
      <div>
        <span className="label">Setup required</span>
        <h1 className="d2">Customer access is not configured.</h1>
        <p className="lede">
          Add the Supabase project URL and publishable key to enable the secure
          status portal.
        </p>
        <Link className="btn btn--ink" href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}

function PortalMessage({
  actionHref = "/",
  actionLabel = "Return home",
  description,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  title: string;
}) {
  return (
    <div className="portal">
      <header className="portal-header">
        <div className="wrap portal-header__inner">
          <Link className="portal-brand" href="/">
            CarBuyerBots
          </Link>
          <form action={signOut}>
            <button className="portal-signout" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="wrap portal-message">
        <span className="label">Customer portal</span>
        <h1 className="d2">{title}</h1>
        <p className="lede">{description}</p>
        <Link className="tlink" href={actionHref}>
          {actionLabel} <span aria-hidden="true">→</span>
        </Link>
      </main>
    </div>
  );
}

export default async function PortalPage({ searchParams }: PortalPageProps) {
  if (!hasSupabaseConfiguration()) {
    return <SetupState />;
  }

  const params = await searchParams;
  const requestedEngagementId = normalizeRequestedEngagementId(
    params.engagement,
  );
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email || !user.email_confirmed_at) {
    const next = requestedEngagementId
      ? `/portal?engagement=${requestedEngagementId}`
      : "/portal";
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  try {
    await claimPaidEngagements(user.id, user.email);
  } catch {
    return (
      <PortalMessage
        title="We could not reconcile your payment."
        description="Refresh the page to securely check again. No portal access was granted or changed."
        actionHref="/portal?payment=processing"
        actionLabel="Check payment status"
      />
    );
  }

  const { data: visibleEngagements, error: engagementError } = await supabase
    .from("engagements")
    .select(
      "amount_cents, created_at, currency, id, payment_status, stripe_checkout_session_id, stripe_payment_intent_id, workflow_status",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (engagementError) {
    return (
      <PortalMessage
        title="We could not load your portal."
        description="Refresh the page to try again. No account details were changed."
      />
    );
  }

  const engagements = orderCustomerEngagements(visibleEngagements ?? []);
  const engagement = selectCustomerEngagement(
    engagements,
    requestedEngagementId,
  );

  if (!engagement) {
    const paymentState = Array.isArray(params.payment)
      ? params.payment[0]
      : params.payment;
    if (paymentState === "processing") {
      return (
        <PortalMessage
          title="Payment is still processing."
          description="The verified webhook has not linked a paid engagement yet. This Checkout display does not grant portal access. Check again after Stripe finishes processing."
          actionHref="/portal?payment=processing"
          actionLabel="Check payment status"
        />
      );
    }
    return (
      <PortalMessage
        title="No active engagement."
        description="No paid vehicle search is linked to this signed-in account. Use the verified email from checkout, or contact support with your payment reference."
      />
    );
  }

  const [briefResult, updatesResult] = await Promise.all([
    supabase
      .from("vehicle_briefs")
      .select(
        "budget_cents, city, colors, condition, deal_breakers, financing_preference, has_trade_in, make, model, notes, options, postal_code, search_radius_miles, state, timeline, trade_in_details, trim, year_max, year_min",
      )
      .eq("engagement_id", engagement.id)
      .maybeSingle(),
    supabase
      .from("status_updates")
      .select(
        "created_at, customer_visible, id, note, status, title",
      )
      .eq("engagement_id", engagement.id)
      .order("created_at", { ascending: true }),
  ]);

  if (briefResult.error || updatesResult.error) {
    return (
      <PortalMessage
        title="We could not load your status record."
        description="Refresh the page to try again. Your engagement remains securely stored."
      />
    );
  }

  return (
    <PortalShell
      brief={briefResult.data}
      engagement={engagement}
      engagements={engagements}
      signOutAction={signOut}
      updates={updatesResult.data ?? []}
    />
  );
}
