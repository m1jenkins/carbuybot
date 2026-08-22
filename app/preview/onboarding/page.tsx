import { IntakePreview } from "@/components/preview/intake-preview";
import { ReviewFixtureNotice } from "@/components/preview/review-fixture-notice";
import { requireReviewFixture } from "@/lib/preview/guard";

export default function PreviewOnboardingPage() {
  requireReviewFixture();

  return (
    <>
      <ReviewFixtureNotice surface="Conversational onboarding" />
      <main>
        <IntakePreview />
      </main>
    </>
  );
}
