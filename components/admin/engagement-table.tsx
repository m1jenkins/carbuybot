"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { workflowLabels } from "@/lib/domain/admin-engagement";
import { workflowStatuses } from "@/lib/domain/engagement";

import type { AdminQueueEngagement } from "./types";

type EngagementTableProps = {
  engagements: readonly AdminQueueEngagement[];
  now?: string;
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
  now = new Date().toISOString(),
}: EngagementTableProps) {
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");

  const visibleEngagements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return engagements
      .filter(
        (engagement) =>
          workflowFilter === "all" ||
          engagement.workflowStatus === workflowFilter,
      )
      .filter(
        (engagement) =>
          paymentFilter === "all" ||
          engagement.paymentStatus === paymentFilter,
      )
      .filter((engagement) => {
        if (!normalizedQuery) return true;
        const vehicle = engagement.vehicle;
        return [
          engagement.customerEmail,
          engagement.customerName,
          vehicle?.make,
          vehicle?.model,
          vehicle?.city,
          vehicle?.state,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        if (sort === "oldest") {
          return left.createdAt.localeCompare(right.createdAt);
        }
        if (sort === "customer") {
          return (
            left.customerName ?? left.customerEmail
          ).localeCompare(right.customerName ?? right.customerEmail);
        }
        if (sort === "vehicle") {
          return vehicleLabel(left).localeCompare(vehicleLabel(right));
        }
        return right.createdAt.localeCompare(left.createdAt);
      });
  }, [engagements, paymentFilter, query, sort, workflowFilter]);

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

      <div className="admin-controls">
        <label>
          <span>Search engagements</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Customer, vehicle, or location"
          />
        </label>
        <label>
          <span>Filter by workflow</span>
          <select
            value={workflowFilter}
            onChange={(event) => setWorkflowFilter(event.target.value)}
          >
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
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
          >
            <option value="all">All payment states</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label>
          <span>Sort engagements</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="customer">Customer A–Z</option>
            <option value="vehicle">Vehicle A–Z</option>
          </select>
        </label>
      </div>

      <p className="sr-only" aria-live="polite">
        {visibleEngagements.length} engagements shown.
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
            {visibleEngagements.map((engagement) => (
              <tr key={engagement.id}>
                <td data-label="Vehicle">
                  <Link
                    className="admin-vehicle-link"
                    href={`/admin/engagements/${engagement.id}`}
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
                  <span
                    className={
                      engagement.paymentStatus === "paid" ? "money" : undefined
                    }
                  >
                    {paymentLabels[engagement.paymentStatus]}
                  </span>
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

      {visibleEngagements.length === 0 ? (
        <p className="admin-empty" role="status">
          No engagements match these filters.
        </p>
      ) : null}
    </section>
  );
}
