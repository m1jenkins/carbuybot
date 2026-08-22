import { AdminOverview } from "@/components/admin/admin-overview";
import { ReviewFixtureNotice } from "@/components/preview/review-fixture-notice";
import {
  reviewAdminCounts,
  reviewAdminQuery,
  reviewAdminQueue,
} from "@/lib/preview/fixtures";
import { requireReviewFixture } from "@/lib/preview/guard";

export default function PreviewAdminPage() {
  requireReviewFixture();

  return (
    <>
      <ReviewFixtureNotice surface="Admin overview" />
      <AdminOverview
        counts={reviewAdminCounts}
        engagements={reviewAdminQueue}
        filteredCount={reviewAdminQueue.length}
        pageCount={1}
        query={reviewAdminQuery}
        reviewMode
      />
    </>
  );
}
