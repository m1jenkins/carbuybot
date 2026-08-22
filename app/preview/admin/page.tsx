import { AdminOverview } from "@/components/admin/admin-overview";
import { AdminReviewShell } from "@/components/preview/admin-review-shell";
import {
  reviewAdminCounts,
  selectReviewAdminQueue,
} from "@/lib/preview/fixtures";
import { requireReviewFixture } from "@/lib/preview/guard";
import { parseAdminQueueSearchParams } from "@/lib/domain/admin-query";

type PreviewAdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PreviewAdminPage({
  searchParams = Promise.resolve({}),
}: PreviewAdminPageProps = {}) {
  requireReviewFixture();
  const parsedQuery = parseAdminQueueSearchParams(await searchParams);
  const query = { ...parsedQuery, page: 1 };
  const engagements = selectReviewAdminQueue(query);

  return (
    <AdminReviewShell surface="Admin overview">
      <AdminOverview
        counts={reviewAdminCounts}
        engagements={engagements}
        filteredCount={engagements.length}
        pageCount={1}
        query={query}
        reviewMode
      />
    </AdminReviewShell>
  );
}
