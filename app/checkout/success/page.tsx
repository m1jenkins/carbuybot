import Link from "next/link";

import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { getStripe } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

type SuccessPageProps = {
  searchParams: Promise<{
    session_id?: string | string[];
  }>;
};

function formatAmount(amount: number | null, currency: string | null) {
  if (!Number.isSafeInteger(amount) || amount === null || !currency) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default async function SuccessPage({
  searchParams,
}: SuccessPageProps) {
  const params = await searchParams;
  const sessionId =
    typeof params.session_id === "string" ? params.session_id : null;
  let session = null;

  if (sessionId?.startsWith("cs_test_")) {
    try {
      session = await getStripe().checkout.sessions.retrieve(sessionId);
    } catch {
      session = null;
    }
  }

  const isPaymentSession = session?.mode === "payment";
  const isPaid = isPaymentSession && session?.payment_status === "paid";
  const email =
    session?.customer_details?.email ?? session?.customer_email ?? "";
  const amount = session
    ? formatAmount(session.amount_total, session.currency)
    : null;

  return (
    <main className="result-page dark">
      <div className="result-shell">
        <Link className="result-brand" href="/">
          CarBuyerBots
        </Link>

        {isPaid ? (
          <section className="result-copy" aria-labelledby="checkout-result">
            <span className="label">Checkout complete</span>
            <h1 className="d2" id="checkout-result">
              Payment confirmed.
            </h1>
            {amount ? (
              <p className="result-amount money num">{amount}</p>
            ) : null}
            <p className="lede">
              Your secure portal is next. Use the same email to receive a
              one-time sign-in link and continue with your vehicle brief.
            </p>
            <MagicLinkForm
              defaultEmail={email}
              destination="/portal?payment=processing"
            />
          </section>
        ) : session && !isPaymentSession ? (
          <section className="result-copy" aria-labelledby="checkout-result">
            <span className="label">Checkout status</span>
            <h1 className="d2" id="checkout-result">
              This checkout mode is not supported.
            </h1>
            <p className="lede">
              This portal accepts one-time payments only. No onboarding access
              has been created from this checkout.
            </p>
            <Link className="btn btn--line" href="/">
              Return home
            </Link>
          </section>
        ) : session ? (
          <section className="result-copy" aria-labelledby="checkout-result">
            <span className="label">Checkout received</span>
            <h1 className="d2" id="checkout-result">
              Payment is processing.
            </h1>
            <p className="lede">
              Stripe is still confirming the payment. No access has been
              created yet. Refresh this page after confirmation arrives.
            </p>
            <Link
              className="btn btn--line"
              href={`/checkout/success?session_id=${encodeURIComponent(
                session.id,
              )}`}
            >
              Check payment status
            </Link>
          </section>
        ) : (
          <section className="result-copy" aria-labelledby="checkout-result">
            <span className="label">Checkout status</span>
            <h1 className="d2" id="checkout-result">
              We could not confirm this checkout.
            </h1>
            <p className="lede">
              The session is missing, incomplete, or not from the test
              checkout environment. Return home to try again.
            </p>
            <Link className="btn btn--line" href="/">
              Return home
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
