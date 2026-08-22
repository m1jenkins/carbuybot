import type { Tables } from "@/lib/supabase/database.types";

type EngagementRow = Tables<"engagements">;
type BriefRow = Tables<"vehicle_briefs">;
type StatusUpdateRow = Tables<"status_updates">;

export type AdminVehicleSummary = {
  city: BriefRow["city"];
  make: BriefRow["make"];
  model: BriefRow["model"];
  state: BriefRow["state"];
  yearMax: BriefRow["year_max"];
  yearMin: BriefRow["year_min"];
};

export type AdminQueueEngagement = {
  amountCents: EngagementRow["amount_cents"];
  createdAt: EngagementRow["created_at"];
  currency: EngagementRow["currency"];
  customerEmail: EngagementRow["customer_email"];
  customerName: Tables<"profiles">["full_name"] | null;
  id: EngagementRow["id"];
  paymentStatus: EngagementRow["payment_status"];
  updatedAt: EngagementRow["updated_at"];
  vehicle: AdminVehicleSummary | null;
  workflowStatus: EngagementRow["workflow_status"];
};

export type AdminEngagementDetail = AdminQueueEngagement & {
  onboardingCompletedAt: EngagementRow["onboarding_completed_at"];
  stripeCheckoutSessionId: EngagementRow["stripe_checkout_session_id"];
  stripeCustomerId: EngagementRow["stripe_customer_id"];
  stripePaymentIntentId: EngagementRow["stripe_payment_intent_id"];
};

export type AdminBrief = {
  budgetCents: BriefRow["budget_cents"];
  city: BriefRow["city"];
  colors: BriefRow["colors"];
  condition: BriefRow["condition"];
  consent: BriefRow["consent"];
  createdAt: BriefRow["created_at"];
  dealBreakers: BriefRow["deal_breakers"];
  financingPreference: BriefRow["financing_preference"];
  hasTradeIn: BriefRow["has_trade_in"];
  make: BriefRow["make"];
  model: BriefRow["model"];
  notes: BriefRow["notes"];
  options: BriefRow["options"];
  postalCode: BriefRow["postal_code"];
  searchRadiusMiles: BriefRow["search_radius_miles"];
  state: BriefRow["state"];
  timeline: BriefRow["timeline"];
  tradeInDetails: BriefRow["trade_in_details"];
  trim: BriefRow["trim"];
  updatedAt: BriefRow["updated_at"];
  yearMax: BriefRow["year_max"];
  yearMin: BriefRow["year_min"];
};

export type AdminStatusUpdate = {
  authorId: StatusUpdateRow["author_id"];
  createdAt: StatusUpdateRow["created_at"];
  customerVisible: StatusUpdateRow["customer_visible"];
  id: StatusUpdateRow["id"];
  note: StatusUpdateRow["note"];
  status: StatusUpdateRow["status"];
  title: StatusUpdateRow["title"];
};
