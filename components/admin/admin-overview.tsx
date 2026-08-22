import { workflowLabels } from "@/lib/domain/admin-engagement";
import type { AdminQueueQuery } from "@/lib/domain/admin-query";
import { workflowStatuses } from "@/lib/domain/engagement";
import type { WorkflowStatus } from "@/lib/domain/engagement";

import { EngagementTable } from "./engagement-table";
import type { AdminQueueEngagement } from "./types";

type AdminOverviewProps = {
  counts: Record<WorkflowStatus, number>;
  engagements: readonly AdminQueueEngagement[];
  filteredCount: number;
  pageCount: number;
  query: AdminQueueQuery;
};

export function AdminOverview({
  counts,
  engagements,
  filteredCount,
  pageCount,
  query,
}: AdminOverviewProps) {
  const totalCount = workflowStatuses.reduce(
    (total, status) => total + counts[status],
    0,
  );

  return (
    <main id="admin-main" className="admin-main">
      <section className="wrap admin-intro" aria-labelledby="admin-title">
        <div>
          <span className="label">Operations</span>
          <h1 className="d2" id="admin-title">
            Engagement review
          </h1>
        </div>
        <p className="lede">
          Review verified customer briefs and post only confirmed,
          customer-visible workflow updates.
        </p>
      </section>

      <section className="admin-queue" aria-labelledby="admin-queue-title">
        <div className="wrap">
          <div className="admin-queue__heading">
            <span className="label" id="admin-queue-title">
              Workflow queue
            </span>
            <span className="cap num">
              {totalCount.toLocaleString("en-US")} total
            </span>
          </div>
          <ul aria-label="Workflow queue counts">
            {workflowStatuses.map((status) => (
              <li key={status}>
                <span>{workflowLabels[status]}</span>
                <strong className="num">
                  {counts[status].toLocaleString("en-US")}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="wrap admin-record">
        <EngagementTable
          engagements={engagements}
          filteredCount={filteredCount}
          pageCount={pageCount}
          query={query}
        />
      </div>
    </main>
  );
}
