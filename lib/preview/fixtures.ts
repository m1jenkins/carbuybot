import type {
  AdminBrief,
  AdminEngagementDetail,
  AdminQueueEngagement,
  AdminStatusUpdate,
} from "@/components/admin/types";
import type { AdminQueueQuery } from "@/lib/domain/admin-query";
import type { WorkflowStatus } from "@/lib/domain/engagement";
import type { PortalBrief } from "@/components/portal/brief-summary";
import type {
  PortalEngagement,
} from "@/components/portal/portal-shell";
import type { PortalStatusUpdate } from "@/components/portal/status-timeline";

export const REVIEW_ENGAGEMENT_ID =
  "a6204b70-c308-40e8-b87f-30843d48cb79";
export const REVIEW_COMPLETED_ENGAGEMENT_ID =
  "83aca8da-9a4d-4b26-9414-7f444c39fc3d";
export const REVIEW_NOW = "2026-08-22T16:00:00.000Z";

export const reviewPortalEngagement: PortalEngagement = {
  amount_cents: 34_900,
  created_at: "2026-08-20T12:00:00.000Z",
  currency: "usd",
  id: REVIEW_ENGAGEMENT_ID,
  payment_status: "paid",
  stripe_checkout_session_id: "cs_test_local_review_fixture",
  stripe_payment_intent_id: "pi_test_local_review_fixture",
  workflow_status: "in_review",
};

export const reviewCompletedPortalEngagement: PortalEngagement = {
  ...reviewPortalEngagement,
  created_at: "2026-08-12T12:00:00.000Z",
  id: REVIEW_COMPLETED_ENGAGEMENT_ID,
  stripe_checkout_session_id: "cs_test_completed_review_fixture",
  stripe_payment_intent_id: "pi_test_completed_review_fixture",
  workflow_status: "completed",
};

export const reviewPortalBrief: PortalBrief = {
  budget_cents: 6_000_000,
  city: "Austin",
  colors: ["Savile Silver", "Uyuni White"],
  condition: "either",
  deal_breakers: ["No salvage title"],
  financing_preference: "loan",
  has_trade_in: true,
  make: "Genesis",
  model: "GV80",
  notes: "Prefer a clean, one-owner vehicle.",
  options: ["AWD", "Advanced safety package"],
  postal_code: "78701",
  search_radius_miles: 100,
  state: "TX",
  timeline: "within_30_days",
  trade_in_details: "2018 sedan, approximately 70,000 miles",
  trim: "3.5T Prestige",
  year_max: 2025,
  year_min: 2024,
};

export const reviewPortalUpdates: readonly PortalStatusUpdate[] = [
  {
    created_at: "2026-08-20T13:00:00.000Z",
    customer_visible: true,
    id: "preview-update-brief",
    note: "We received the vehicle brief and recorded the customer criteria.",
    status: "brief_submitted",
    title: "Brief submitted",
  },
  {
    created_at: "2026-08-22T15:00:00.000Z",
    customer_visible: true,
    id: "preview-update-review",
    note: "The brief has been checked for the required vehicle, budget, and location details.",
    status: "in_review",
    title: "Brief review confirmed",
  },
];

const reviewAdminEngagement: AdminEngagementDetail = {
  amountCents: 34_900,
  createdAt: reviewPortalEngagement.created_at,
  currency: "usd",
  customerEmail: "reviewer@example.com",
  customerName: "Review Customer",
  id: REVIEW_ENGAGEMENT_ID,
  onboardingCompletedAt: "2026-08-20T13:00:00.000Z",
  paymentStatus: "paid",
  stripeCheckoutSessionId: reviewPortalEngagement.stripe_checkout_session_id,
  stripeCustomerId: "cus_test_local_review_fixture",
  stripePaymentIntentId: reviewPortalEngagement.stripe_payment_intent_id,
  updatedAt: "2026-08-22T15:00:00.000Z",
  vehicle: {
    city: reviewPortalBrief.city,
    make: reviewPortalBrief.make,
    model: reviewPortalBrief.model,
    state: reviewPortalBrief.state,
    yearMax: reviewPortalBrief.year_max,
    yearMin: reviewPortalBrief.year_min,
  },
  workflowStatus: "in_review",
};

const reviewCompletedAdminEngagement: AdminQueueEngagement = {
  ...reviewAdminEngagement,
  createdAt: reviewCompletedPortalEngagement.created_at,
  customerEmail: "completed-review@example.com",
  customerName: "Completed Review",
  id: REVIEW_COMPLETED_ENGAGEMENT_ID,
  updatedAt: "2026-08-18T15:00:00.000Z",
  workflowStatus: "completed",
};

export const reviewAdminQueue: readonly AdminQueueEngagement[] = [
  reviewAdminEngagement,
  reviewCompletedAdminEngagement,
];

export const reviewAdminCounts: Record<WorkflowStatus, number> = {
  awaiting_brief: 0,
  brief_submitted: 0,
  cancelled: 0,
  completed: 1,
  in_review: 1,
  negotiating: 0,
  offers_ready: 0,
  searching: 0,
};

export const reviewAdminQuery: AdminQueueQuery = {
  emailPattern: null,
  page: 1,
  payment: "all",
  search: "",
  searchId: null,
  sort: "newest",
  status: "all",
};

export const reviewAdminBrief: AdminBrief = {
  budgetCents: reviewPortalBrief.budget_cents,
  city: reviewPortalBrief.city,
  colors: [...reviewPortalBrief.colors],
  condition: reviewPortalBrief.condition,
  consent: true,
  createdAt: "2026-08-20T13:00:00.000Z",
  dealBreakers: [...reviewPortalBrief.deal_breakers],
  financingPreference: reviewPortalBrief.financing_preference,
  hasTradeIn: reviewPortalBrief.has_trade_in,
  make: reviewPortalBrief.make,
  model: reviewPortalBrief.model,
  notes: reviewPortalBrief.notes,
  options: [...reviewPortalBrief.options],
  postalCode: reviewPortalBrief.postal_code,
  searchRadiusMiles: reviewPortalBrief.search_radius_miles,
  state: reviewPortalBrief.state,
  timeline: reviewPortalBrief.timeline,
  tradeInDetails: reviewPortalBrief.trade_in_details,
  trim: reviewPortalBrief.trim,
  updatedAt: "2026-08-22T14:00:00.000Z",
  yearMax: reviewPortalBrief.year_max,
  yearMin: reviewPortalBrief.year_min,
};

export const reviewAdminDetail = reviewAdminEngagement;

export const reviewAdminUpdates: readonly AdminStatusUpdate[] = [
  {
    authorId: "00000000-0000-4000-8000-000000000001",
    createdAt: "2026-08-22T15:00:00.000Z",
    customerVisible: true,
    id: "preview-admin-update-review",
    note: "The required vehicle, budget, and location details were confirmed.",
    status: "in_review",
    title: "Brief review confirmed",
  },
  {
    authorId: REVIEW_ENGAGEMENT_ID,
    createdAt: "2026-08-20T13:00:00.000Z",
    customerVisible: true,
    id: "preview-admin-update-brief",
    note: "The customer submitted the vehicle brief.",
    status: "brief_submitted",
    title: "Brief submitted",
  },
];
