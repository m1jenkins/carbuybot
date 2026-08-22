const fs = require('node:fs');
const path = require('node:path');
const Stripe = require('stripe');
const { createApp } = require('./app');
const { createFileStore } = require('./store');

function loadDotEnv() {
  const files = [
    path.join(__dirname, '..', '..', '.env'),
    path.join(__dirname, '..', '.env'),
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
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
}

loadDotEnv();

function loadConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required');
  }
  return {
    secretKey,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:4242',
    introPriceId: process.env.STRIPE_PRICE_INTRO_ID,
    standardPriceId: process.env.STRIPE_PRICE_STANDARD_ID,
    introCap: Number(process.env.INTRO_COHORT_SIZE || 100),
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    adminApiKey: process.env.ADMIN_API_KEY || '',
    port: Number(process.env.PORT || 4242),
  };
}

function main() {
  const config = loadConfig();
  const stripe = new Stripe(config.secretKey, {
    apiVersion: '2026-07-29.dahlia',
  });
  const store = createFileStore(path.join(__dirname, '..', '..', 'data', 'engagements.json'));
  const staticRoot = path.join(__dirname, '..', '..');
  const app = createApp({ stripe, store, config, staticRoot });
  app.listen(config.port, () => {
    console.log(`CarBuyerBots Stripe server listening on ${config.publicBaseUrl}`);
  });
}

main();
