const fs = require('node:fs');
const path = require('node:path');
const Stripe = require('stripe');

function loadDotEnv() {
  const file = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadDotEnv();
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required');
  }
  const stripe = new Stripe(secretKey, { apiVersion: '2026-07-29.dahlia' });

  const introProduct = await stripe.products.create({
    name: 'CarBuyerBots launch engagement',
    description: 'One-car AI buying agent. Intro price for the first 100 customers.',
    metadata: { sku: 'cbb_intro' },
  });
  const introPrice = await stripe.prices.create({
    product: introProduct.id,
    currency: 'usd',
    unit_amount: 34900,
  });

  const standardProduct = await stripe.products.create({
    name: 'CarBuyerBots car buying engagement',
    description: 'One-car AI buying agent. Flat fee, refunded if we do not save more than the fee.',
    metadata: { sku: 'cbb_standard' },
  });
  const standardPrice = await stripe.prices.create({
    product: standardProduct.id,
    currency: 'usd',
    unit_amount: 39900,
  });

  console.log('Created Stripe catalog:');
  console.log(`STRIPE_PRICE_INTRO_ID=${introPrice.id}`);
  console.log(`STRIPE_PRICE_STANDARD_ID=${standardPrice.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
