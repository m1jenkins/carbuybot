function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export function getStripeSecretKey(): string {
  return requireEnvironmentVariable("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret(): string {
  const secret = requireEnvironmentVariable("STRIPE_WEBHOOK_SECRET");

  if (!secret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not a Stripe webhook secret");
  }

  return secret;
}

export function getStripePriceIds(): {
  intro: string;
  standard: string;
} {
  const intro = requireEnvironmentVariable("STRIPE_PRICE_INTRO_ID");
  const standard = requireEnvironmentVariable("STRIPE_PRICE_STANDARD_ID");

  if (!intro.startsWith("price_") || !standard.startsWith("price_")) {
    throw new Error("Stripe Price IDs must begin with price_");
  }

  return { intro, standard };
}

export function getAppUrl(): string {
  const configuredUrl = requireEnvironmentVariable("NEXT_PUBLIC_APP_URL");
  const url = new URL(configuredUrl);

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("NEXT_PUBLIC_APP_URL must be an HTTP(S) origin");
  }

  return url.origin;
}
