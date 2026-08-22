import { notFound } from "next/navigation";

import { EngagementReview } from "@/components/admin/engagement-review";
import { AdminReviewShell } from "@/components/preview/admin-review-shell";
import {
  REVIEW_ENGAGEMENT_ID,
  reviewAdminBrief,
  reviewAdminDetail,
  reviewAdminUpdates,
} from "@/lib/preview/fixtures";
import { requireReviewFixture } from "@/lib/preview/guard";

type PreviewAdminDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PreviewAdminDetailPage({
  params,
}: PreviewAdminDetailPageProps) {
  requireReviewFixture();
  const { id } = await params;
  if (id !== REVIEW_ENGAGEMENT_ID) {
    notFound();
  }

  return (
    <AdminReviewShell surface="Admin engagement detail">
      <EngagementReview
        brief={reviewAdminBrief}
        engagement={reviewAdminDetail}
        historyPage={1}
        historyPageCount={1}
        historyTotal={reviewAdminUpdates.length}
        reviewMode
        updates={reviewAdminUpdates}
      />
    </AdminReviewShell>
  );
}
