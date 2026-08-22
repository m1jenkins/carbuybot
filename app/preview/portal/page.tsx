import { PortalShell } from "@/components/portal/portal-shell";
import { ReviewFixtureNotice } from "@/components/preview/review-fixture-notice";
import {
  reviewCompletedPortalEngagement,
  reviewPortalBrief,
  reviewPortalEngagement,
  reviewPortalUpdates,
} from "@/lib/preview/fixtures";
import { requireReviewFixture } from "@/lib/preview/guard";

type PreviewPortalPageProps = {
  searchParams?: Promise<{
    engagement?: string | string[];
  }>;
};

export default async function PreviewPortalPage({
  searchParams = Promise.resolve({}),
}: PreviewPortalPageProps = {}) {
  requireReviewFixture();
  const params = await searchParams;
  const engagements = [
    reviewPortalEngagement,
    reviewCompletedPortalEngagement,
  ] as const;
  const requestedEngagement =
    typeof params.engagement === "string" ? params.engagement : null;
  const selectedEngagement =
    engagements.find(({ id }) => id === requestedEngagement) ??
    reviewPortalEngagement;

  return (
    <>
      <ReviewFixtureNotice surface="Customer portal" />
      <PortalShell
        brief={reviewPortalBrief}
        engagement={selectedEngagement}
        engagements={engagements}
        reviewMode
        updates={reviewPortalUpdates}
      />
    </>
  );
}
