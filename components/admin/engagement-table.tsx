import Link from "next/link";

import { ADMIN_QUEUE_PAGE_SIZE } from "@/lib/admin/engagement-queries";
import { workflowLabels } from "@/lib/domain/admin-engagement";
import {
  adminQueueHref,
  type AdminQueueQuery,
} from "@/lib/domain/admin-query";
import { workflowStatuses } from "@/lib/domain/engagement";

import type { AdminQueueEngagement } from "./types";

type EngagementTableProps = {
  engagements: readonly AdminQueueEngagement[];
  filteredCount: number;
  now?: string;
  pageCount: number;
  reviewMode?: boolean;
  query: AdminQueueQuery;
};

const paymentLabels: Record<
  AdminQueueEngagement["paymentStatus"],
  string
> = {
  failed: "Failed",
  paid: "Paid",
  pending: "Pending",
  refunded: "Refunded",
};

function vehicleLabel(engagement: AdminQueueEngagement): string {
  const vehicle = engagement.vehicle;
  if (!vehicle) return "Brief not submitted";

  const years =
    vehicle.yearMin && vehicle.yearMax
      ? vehicle.yearMin === vehicle.yearMax
        ? `${vehicle.yearMin}`
        : `${vehicle.yearMin}–${vehicle.yearMax}`
      : vehicle.yearMin
        ? `${vehicle.yearMin}+`
        : vehicle.yearMax
          ? `Up to ${vehicle.yearMax}`
          : "";
  return [years, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

function formatAmount(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      currency: currency.toUpperCase(),
      style: "currency",
    }).format(amountCents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`;
  }
}

function formatAge(createdAt: string, now: string): string {
  const elapsedMs = Math.max(
    0,
    new Date(now).getTime() - new Date(createdAt).getTime(),
  );
  const hours = Math.floor(elapsedMs / 3_600_000);
  if (hours < 1) return "Under 1 hour";
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function EngagementTable({
  engagements,
  filteredCount,
  now = new Date().toISOString(),
  pageCount,
  reviewMode = false,
  query,
}: EngagementTableProps) {
  const firstVisible =
    filteredCount === 0 ? 0 : (query.page - 1) * ADMIN_QUEUE_PAGE_SIZE + 1;
  const lastVisible =
    filteredCount === 0 ? 0 : firstVisible + engagements.length - 1;

  return (
    <section className="admin-list" aria-labelledby="admin-list-title">
      <div className="admin-section-heading">
        <div>
          <span className="label">Engagements</span>
          <h2 className="d3" id="admin-list-title">
            Review queue
          </h2>
        </div>
        <p className="cap">
          Filter the RLS-protected queue before opening a customer record.
        </p>
      </div>

      <form
        className="admin-controls"
        action={reviewMode ? "/preview/admin" : "/admin"}
        method="get"
      >
        <label>
          <span>Search engagements</span>
          <input
            name="q"
            type="search"
            defaultValue={query.search}
            maxLength={320}
            placeholder="Customer email or engagement UUID"
          />
        </label>
        <label>
          <span>Filter by workflow</span>
          <select name="status" defaultValue={query.status}>
            <option value="all">All workflow states</option>
            {workflowStatuses.map((status) => (
              <option key={status} value={status}>
                {workflowLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Filter by payment</span>
          <select name="payment" defaultValue={query.payment}>
            <option value="all">All payment states</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label>
          <span>Sort engagements</span>
          <select name="sort" defaultValue={query.sort}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="customer">Customer email A–Z</option>
          </select>
        </label>
        <button className="admin-filter-submit" type="submit">
          Apply filters
        </button>
      </form>

      <p className="admin-list-summary" role="status" aria-live="polite">
        Showing {firstVisible.toLocaleString("en-US")}–
        {lastVisible.toLocaleString("en-US")} of{" "}
        {filteredCount.toLocaleString("en-US")} engagements.
      </p>

      <div className="admin-table">
        <table aria-label="Engagement review queue">
          <caption>
            Customer engagements available to the signed-in administrator
          </caption>
          <thead>
            <tr>
              <th scope="col">Vehicle</th>
              <th scope="col">Customer</th>
              <th scope="col">Location</th>
              <th scope="col">Age</th>
              <th scope="col">Payment</th>
              <th scope="col">Workflow</th>
            </tr>
          </thead>
          <tbody>
            {engagements.map((engagement) => (
              <tr key={engagement.id}>
                <td data-label="Vehicle">
                  <Link
                    className="admin-vehicle-link"
                    href={`${
                      reviewMode ? "/preview/admin" : "/admin"
                    }/engagements/${engagement.id}`}
                  >
                    {vehicleLabel(engagement)}
                  </Link>
                </td>
                <td data-label="Customer">
                  <span>{engagement.customerName ?? "Name unavailable"}</span>
                  <small>{engagement.customerEmail}</small>
                </td>
                <td data-label="Location">
                  {engagement.vehicle
                    ? `${engagement.vehicle.city}, ${engagement.vehicle.state}`
                    : "Not submitted"}
                </td>
                <td data-label="Age" className="num">
                  <time dateTime={engagement.createdAt}>
                    {formatAge(engagement.createdAt, now)}
                  </time>
                </td>
                <td data-label="Payment">
                  <span>{paymentLabels[engagement.paymentStatus]}</span>
                  <small className="money num">
                    {formatAmount(
                      engagement.amountCents,
                      engagement.currency,
                    )}
                  </small>
                </td>
                <td data-label="Workflow">
                  {workflowLabels[engagement.workflowStatus]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {engagements.length === 0 ? (
        <p className="admin-empty" role="status">
          No engagements match these filters.
        </p>
      ) : null}

      {pageCount > 1 ? (
        <nav className="admin-pagination" aria-label="Queue pages">
          {query.page > 1 ? (
            <Link
              href={
                reviewMode
                  ? adminQueueHref(query, query.page - 1).replace(
                      "/admin?",
                      "/preview/admin?",
                    )
                  : adminQueueHref(query, query.page - 1)
              }
            >
              Previous page
            </Link>
          ) : (
            <span aria-disabled="true">Previous page</span>
          )}
          <span aria-current="page">
            Page {query.page.toLocaleString("en-US")} of{" "}
            {pageCount.toLocaleString("en-US")}
          </span>
          {query.page < pageCount ? (
            <Link
              href={
                reviewMode
                  ? adminQueueHref(query, query.page + 1).replace(
                      "/admin?",
                      "/preview/admin?",
                    )
                  : adminQueueHref(query, query.page + 1)
              }
            >
              Next page
            </Link>
          ) : (
            <span aria-disabled="true">Next page</span>
          )}
        </nav>
      ) : null}
    </section>
  );
}
