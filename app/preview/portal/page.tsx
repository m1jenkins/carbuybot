import { PortalShell } from "@/components/portal/portal-shell";
import { ReviewFixtureNotice } from "@/components/preview/review-fixture-notice";
import {
  reviewCompletedPortalEngagement,
  reviewPortalBrief,
  reviewPortalEngagement,
  reviewPortalUpdates,
} from "@/lib/preview/fixtures";
import { requireReviewFixture } from "@/lib/preview/guard";

export default function PreviewPortalPage() {
  requireReviewFixture();

  return (
    <>
      <ReviewFixtureNotice surface="Customer portal" />
      <PortalShell
        brief={reviewPortalBrief}
        engagement={reviewPortalEngagement}
        engagements={[
          reviewPortalEngagement,
          reviewCompletedPortalEngagement,
        ]}
        reviewMode
        updates={reviewPortalUpdates}
      />
    </>
  );
}
