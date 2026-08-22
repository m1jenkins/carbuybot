import "server-only";

import Stripe from "stripe";

import { getStripeSecretKey } from "../env";

const testKeyPrefixes = ["sk_test_", "rk_test_"] as const;
const liveKeyPrefixes = ["sk_live_", "rk_live_"] as const;

export function assertTestStripeKey(key: string): string {
  const normalizedKey = key.trim();

  if (
    liveKeyPrefixes.some((prefix) => normalizedKey.startsWith(prefix)) ||
    !testKeyPrefixes.some((prefix) => normalizedKey.startsWith(prefix))
  ) {
    throw new Error("Stripe must be configured with a test-mode secret key");
  }

  return normalizedKey;
}

export function getStripe(): Stripe {
  return new Stripe(assertTestStripeKey(getStripeSecretKey()));
}
