import "server-only";

import { createAdminClient } from "../supabase/admin";

export type StripeEventInput =
  | {
      amountCents: number;
      checkoutSessionId: string;
      currency: string;
      customerEmail: string;
      customerId: string;
      engagementId: string;
      eventId: string;
      eventType: string;
      fulfill: true;
      paymentIntentId: string;
      priceId: string;
    }
  | {
      amountCents: null;
      checkoutSessionId: null;
      currency: null;
      customerEmail: null;
      customerId: null;
      engagementId: null;
      eventId: string;
      eventType: string;
      fulfill: false;
      paymentIntentId: null;
      priceId: null;
    };

export type PersistStripeEvent = (input: StripeEventInput) => Promise<boolean>;

type PendingEngagementInput = {
  amountCents: number;
  currency: string;
  customerEmail: string;
  priceId: string;
};

export async function countPaidEngagements(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("engagements")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "paid");

  if (error) {
    throw new Error(error.message);
  }
  if (count === null) {
    throw new Error("Paid engagement count was not returned");
  }

  return count;
}

export async function createPendingEngagement(
  input: PendingEngagementInput,
): Promise<{ id: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("engagements")
    .insert({
      amount_cents: input.amountCents,
      currency: input.currency,
      customer_email: input.customerEmail,
      payment_status: "pending",
      price_id: input.priceId,
      workflow_status: "awaiting_brief",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Pending engagement was not created");
  }

  return data;
}

export const persistStripeEvent: PersistStripeEvent = async (input) => {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fulfill_stripe_event", {
    p_amount_cents: input.amountCents,
    p_checkout_session_id: input.checkoutSessionId,
    p_currency: input.currency,
    p_customer_email: input.customerEmail,
    p_customer_id: input.customerId,
    p_engagement_id: input.engagementId,
    p_event_id: input.eventId,
    p_event_type: input.eventType,
    p_fulfill: input.fulfill,
    p_payment_intent_id: input.paymentIntentId,
    p_price_id: input.priceId,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (typeof data !== "boolean") {
    throw new Error("Stripe fulfillment transaction returned an invalid result");
  }

  return data;
};
