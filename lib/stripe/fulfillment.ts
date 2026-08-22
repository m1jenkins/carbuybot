import "server-only";

import type Stripe from "stripe";

import { normalizeEmail } from "../domain/engagement";
import {
  persistStripeEvent,
  persistStripeExpiration,
  persistStripeRefund,
  type PersistStripeEvent,
  type PersistStripeExpiration,
  type PersistStripeRefund,
  type StripeEventInput,
} from "./repository";

export type {
  PersistStripeEvent,
  PersistStripeExpiration,
  PersistStripeRefund,
  StripeEventInput,
} from "./repository";

type FulfillmentResult = "processed" | "duplicate";

type EventContext = {
  eventId: string;
  eventType:
    | "checkout.session.completed"
    | "checkout.session.async_payment_succeeded";
};

function expandableId(
  value: string | { id: string } | null,
  field: string,
): string {
  const id = typeof value === "string" ? value : value?.id;

  if (!id) {
    throw new Error(`Paid Checkout Session is missing ${field}`);
  }

  return id;
}

function eventOnlyInput(
  eventId: string,
  eventType: string,
): StripeEventInput {
  return {
    amountCents: null,
    checkoutSessionId: null,
    currency: null,
    customerEmail: null,
    customerId: null,
    engagementId: null,
    eventId,
    eventType,
    fulfill: false,
    paymentIntentId: null,
    priceId: null,
  };
}

function resultForInserted(inserted: boolean): FulfillmentResult {
  return inserted ? "processed" : "duplicate";
}

function checkoutIdentity(session: Stripe.Checkout.Session) {
  if (session.livemode || !session.id.startsWith("cs_test_")) {
    throw new Error("Only test-mode Checkout Sessions can be processed");
  }
  const engagementId = session.metadata?.engagement_id;
  const priceId = session.metadata?.price_id;
  if (!engagementId || session.client_reference_id !== engagementId) {
    throw new Error(
      "Checkout Session reference does not match engagement metadata",
    );
  }
  if (!priceId) {
    throw new Error("Checkout Session is missing Price metadata");
  }
  return { engagementId, priceId };
}

export async function fulfillCheckoutSession(
  session: Stripe.Checkout.Session,
  context: EventContext = {
    eventId: `evt_session_${session.id}`,
    eventType: "checkout.session.completed",
  },
  persist: PersistStripeEvent = persistStripeEvent,
): Promise<FulfillmentResult> {
  if (session.livemode || !session.id.startsWith("cs_test_")) {
    throw new Error("Only test-mode Checkout Sessions can be fulfilled");
  }

  if (session.mode !== "payment") {
    return resultForInserted(
      await persist(eventOnlyInput(context.eventId, context.eventType)),
    );
  }

  if (session.payment_status !== "paid") {
    return resultForInserted(
      await persist(eventOnlyInput(context.eventId, context.eventType)),
    );
  }

  const { engagementId, priceId } = checkoutIdentity(session);
  const customerEmail =
    session.customer_details?.email ?? session.customer_email;

  if (!customerEmail) {
    throw new Error("Paid Checkout Session is missing a customer email");
  }
  if (
    !Number.isSafeInteger(session.amount_total) ||
    (session.amount_total ?? 0) <= 0
  ) {
    throw new Error("Paid Checkout Session has an invalid amount");
  }
  if (!session.currency) {
    throw new Error("Paid Checkout Session is missing a currency");
  }

  return resultForInserted(
    await persist({
      amountCents: session.amount_total!,
      checkoutSessionId: session.id,
      currency: session.currency.toLowerCase(),
      customerEmail: normalizeEmail(customerEmail),
      customerId: expandableId(session.customer, "a Stripe customer"),
      engagementId,
      eventId: context.eventId,
      eventType: context.eventType,
      fulfill: true,
      paymentIntentId: expandableId(
        session.payment_intent,
        "a PaymentIntent",
      ),
      priceId,
    }),
  );
}

export async function processEvent(
  event: Stripe.Event,
  persist: PersistStripeEvent = persistStripeEvent,
  expire: PersistStripeExpiration = persistStripeExpiration,
  refund: PersistStripeRefund = persistStripeRefund,
): Promise<FulfillmentResult> {
  if (event.livemode) {
    throw new Error("Only test-mode Stripe events can be processed");
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    return fulfillCheckoutSession(
      event.data.object as Stripe.Checkout.Session,
      {
        eventId: event.id,
        eventType: event.type,
      },
      persist,
    );
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "payment") {
      return resultForInserted(
        await persist(eventOnlyInput(event.id, event.type)),
      );
    }
    const { engagementId, priceId } = checkoutIdentity(session);
    return resultForInserted(
      await expire({
        checkoutSessionId: session.id,
        engagementId,
        eventId: event.id,
        priceId,
      }),
    );
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    if (charge.livemode) {
      throw new Error("Only test-mode Stripe charges can be processed");
    }
    if (charge.refunded) {
      return resultForInserted(
        await refund({
          eventId: event.id,
          paymentIntentId: expandableId(
            charge.payment_intent,
            "a PaymentIntent",
          ),
        }),
      );
    }
  }

  return resultForInserted(
    await persist(eventOnlyInput(event.id, event.type)),
  );
}
