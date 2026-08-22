import { NextResponse } from "next/server";

import { normalizeEmail } from "@/lib/domain/engagement";
import { getAppUrl, getStripePriceIds } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { reserveCheckoutEngagement } from "@/lib/stripe/repository";

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
    const priceIds = getStripePriceIds();
    const stripe = getStripe();
    const engagement = await reserveCheckoutEngagement({
      customerEmail: email,
      introPriceId: priceIds.intro,
      standardPriceId: priceIds.standard,
    });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      customer_creation: "always",
      line_items: [{ price: engagement.priceId, quantity: 1 }],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel`,
      client_reference_id: engagement.id,
      metadata: {
        engagement_id: engagement.id,
        price_id: engagement.priceId,
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
