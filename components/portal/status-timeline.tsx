import type { Tables } from "@/lib/supabase/database.types";

export type PortalStatusUpdate = Pick<
  Tables<"status_updates">,
  "created_at" | "customer_visible" | "id" | "note" | "status" | "title"
>;

type StatusTimelineProps = {
  updates: readonly PortalStatusUpdate[];
};

function formatUpdateDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function StatusTimeline({ updates }: StatusTimelineProps) {
  const visibleUpdates = [...updates]
    .filter((update) => update.customer_visible)
    .sort(
      (first, second) =>
        new Date(first.created_at).getTime() -
        new Date(second.created_at).getTime(),
    );

  return (
    <section
      className="portal-updates"
      aria-labelledby="portal-updates-title"
    >
      <div className="portal-section-heading">
        <span className="label">Progress record</span>
        <h2 className="d3" id="portal-updates-title">
          Updates
        </h2>
      </div>

      {visibleUpdates.length === 0 ? (
        <p className="portal-empty-copy">
          No customer updates have been posted yet. The current stage above is
          the latest information available.
        </p>
      ) : (
        <ol className="portal-timeline" aria-label="Status updates">
          {visibleUpdates.map((update) => (
            <li className="portal-timeline__item" key={update.id}>
              <div className="portal-timeline__date">
                <time dateTime={update.created_at}>
                  {formatUpdateDate(update.created_at)}
                </time>
              </div>
              <div className="portal-timeline__copy">
                <h3>{update.title}</h3>
                <p>{update.note}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
