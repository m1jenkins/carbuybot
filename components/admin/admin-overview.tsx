import { workflowLabels } from "@/lib/domain/admin-engagement";
import { workflowStatuses } from "@/lib/domain/engagement";

import { EngagementTable } from "./engagement-table";
import type { AdminQueueEngagement } from "./types";

type AdminOverviewProps = {
  engagements: readonly AdminQueueEngagement[];
};

export function AdminOverview({ engagements }: AdminOverviewProps) {
  const counts = Object.fromEntries(
    workflowStatuses.map((status) => [
      status,
      engagements.filter(
        (engagement) => engagement.workflowStatus === status,
      ).length,
    ]),
  ) as Record<AdminQueueEngagement["workflowStatus"], number>;

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
            <span className="cap num">{engagements.length} total</span>
          </div>
          <ul aria-label="Workflow queue counts">
            {workflowStatuses.map((status) => (
              <li key={status}>
                <span>{workflowLabels[status]}</span>
                <strong className="num">{counts[status]}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="wrap admin-record">
        <EngagementTable engagements={engagements} />
      </div>
    </main>
  );
}
