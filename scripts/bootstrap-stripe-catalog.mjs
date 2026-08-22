import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Stripe from "stripe";

const testKeyPrefixes = ["sk_test_", "rk_test_", "rkcs_test_"];
const liveKeyPrefixes = ["sk_live_", "rk_live_", "rkcs_live_"];

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function assertTestStripeKey(key) {
  const normalizedKey = key.trim();
  if (
    liveKeyPrefixes.some((prefix) => normalizedKey.startsWith(prefix)) ||
    !testKeyPrefixes.some((prefix) => normalizedKey.startsWith(prefix))
  ) {
    throw new Error("Stripe must be configured with a test-mode secret key");
  }
  return normalizedKey;
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  loadDotEnv(join(root, ".env.local"));
  loadDotEnv(join(root, ".env"));

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required in .env.local");
  }

  const stripe = new Stripe(assertTestStripeKey(secretKey));

  const introProduct = await stripe.products.create({
    name: "CarBuyerBots launch engagement",
    description:
      "One-car AI buying agent. Intro price for the first 100 checkout reservations.",
    metadata: { sku: "cbb_intro" },
  });
  const introPrice = await stripe.prices.create({
    product: introProduct.id,
    currency: "usd",
    unit_amount: 34_900,
  });

  const standardProduct = await stripe.products.create({
    name: "CarBuyerBots car buying engagement",
    description:
      "One-car AI buying agent. Flat fee, refunded if we do not save more than the fee.",
    metadata: { sku: "cbb_standard" },
  });
  const standardPrice = await stripe.prices.create({
    product: standardProduct.id,
    currency: "usd",
    unit_amount: 39_900,
  });

  console.log("Created Stripe test catalog. Paste into .env.local:");
  console.log(`STRIPE_PRICE_INTRO_ID=${introPrice.id}`);
  console.log(`STRIPE_PRICE_STANDARD_ID=${standardPrice.id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
