import { NextResponse } from "next/server";

import { normalizeEmail } from "@/lib/domain/engagement";
import { getAppUrl } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { choosePrice, getPriceAmountCents } from "@/lib/stripe/pricing";
import {
  countPaidEngagements,
  createPendingEngagement,
} from "@/lib/stripe/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let email: string;

  try {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body?.email !== "string") {
      throw new Error("Email is required");
    }
    email = normalizeEmail(body.email);
  } catch {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const appUrl = getAppUrl();
    const stripe = getStripe();
    const paidCount = await countPaidEngagements();
    const price = choosePrice(paidCount);
    const engagement = await createPendingEngagement({
      amountCents: getPriceAmountCents(price.label),
      currency: "usd",
      customerEmail: email,
      priceId: price.priceId,
    });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      customer_creation: "always",
      line_items: [{ price: price.priceId, quantity: 1 }],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel`,
      client_reference_id: engagement.id,
      metadata: {
        engagement_id: engagement.id,
        price_id: price.priceId,
      },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL");
    }

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again." },
      { status: 500 },
    );
  }
}
