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

export type StripeExpirationInput = {
  checkoutSessionId: string;
  engagementId: string;
  eventId: string;
  priceId: string;
};

export type PersistStripeExpiration = (
  input: StripeExpirationInput,
) => Promise<boolean>;

export type StripeRefundInput = {
  eventId: string;
  paymentIntentId: string;
};

export type PersistStripeRefund = (
  input: StripeRefundInput,
) => Promise<boolean>;

type CheckoutReservationInput = {
  customerEmail: string;
  introPriceId: string;
  standardPriceId: string;
};

type CheckoutReservation = {
  amountCents: number;
  currency: string;
  id: string;
  introSlot: number | null;
  priceId: string;
};

export async function reserveCheckoutEngagement(
  input: CheckoutReservationInput,
): Promise<CheckoutReservation> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reserve_checkout_engagement", {
    p_customer_email: input.customerEmail,
    p_intro_price_id: input.introPriceId,
    p_standard_price_id: input.standardPriceId,
  });

  if (error) {
    throw new Error(error.message);
  }
  const reservation = data?.[0];
  if (
    !reservation ||
    !Number.isSafeInteger(reservation.amount_cents) ||
    typeof reservation.currency !== "string" ||
    typeof reservation.id !== "string" ||
    (reservation.intro_slot !== null &&
      !Number.isSafeInteger(reservation.intro_slot)) ||
    typeof reservation.price_id !== "string"
  ) {
    throw new Error("Checkout reservation transaction returned invalid data");
  }

  return {
    amountCents: reservation.amount_cents,
    currency: reservation.currency,
    id: reservation.id,
    introSlot: reservation.intro_slot,
    priceId: reservation.price_id,
  };
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

export const persistStripeExpiration: PersistStripeExpiration = async (
  input,
) => {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_stripe_checkout", {
    p_checkout_session_id: input.checkoutSessionId,
    p_engagement_id: input.engagementId,
    p_event_id: input.eventId,
    p_price_id: input.priceId,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (typeof data !== "boolean") {
    throw new Error("Stripe expiration transaction returned an invalid result");
  }
  return data;
};

export const persistStripeRefund: PersistStripeRefund = async (input) => {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("refund_stripe_payment", {
    p_event_id: input.eventId,
    p_payment_intent_id: input.paymentIntentId,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (typeof data !== "boolean") {
    throw new Error("Stripe refund transaction returned an invalid result");
  }
  return data;
};
