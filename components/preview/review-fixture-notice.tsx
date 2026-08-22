export function ReviewFixtureNotice({ surface }: { surface: string }) {
  return (
    <aside className="review-fixture-note" aria-label="Local review fixture">
      <strong>Local review fixture</strong>
      <span>
        {surface} uses fictional test records. Interaction is local or disabled;
        it is never saved to Supabase or sent to Stripe.
      </span>
    </aside>
  );
}
