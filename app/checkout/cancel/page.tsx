import Link from "next/link";

export default function CancelPage() {
  return (
    <main className="result-page dark">
      <div className="result-shell">
        <Link className="result-brand" href="/">
          CarBuyerBots
        </Link>
        <section className="result-copy" aria-labelledby="checkout-result">
          <span className="label">No payment taken</span>
          <h1 className="d2" id="checkout-result">
            Checkout canceled.
          </h1>
          <p className="lede">
            Nothing was charged. You can return whenever you are ready to
            start your search.
          </p>
          <Link className="btn btn--line" href="/">
            Return home
          </Link>
        </section>
      </div>
    </main>
  );
}
