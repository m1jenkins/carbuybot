const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Stripe = require('stripe');
const { createApp } = require('../src/app');
const { createMemoryStore } = require('../src/store');

const webhookSecret = 'whsec_test_secret';
const stripeLib = new Stripe('sk_test_placeholder', { apiVersion: '2026-07-29.dahlia' });

function signedPayload(event) {
  const payload = JSON.stringify(event);
  const signature = stripeLib.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
  return { payload, signature };
}

async function postWebhook(app, event, { tamper = false } = {}) {
  const { payload, signature } = signedPayload(event);
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': tamper ? 't=1,v1=bad' : signature,
      },
      body: payload,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const config = {
  publicBaseUrl: 'http://localhost:4242',
  introPriceId: 'price_intro',
  standardPriceId: 'price_standard',
  introCap: 100,
  webhookSecret,
  adminApiKey: 'admin_test',
};

describe('POST /api/webhooks/stripe', () => {
  let store;
  let app;

  beforeEach(() => {
    store = createMemoryStore();
    app = createApp({ stripe: {}, store, config });
  });

  it('rejects events with an invalid signature', async () => {
    const res = await postWebhook(
      app,
      { id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } },
      { tamper: true },
    );
    assert.equal(res.status, 400);
  });

  it('fulfills a paid Checkout Session and is idempotent on retries', async () => {
    const event = {
      id: 'evt_paid_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_status: 'paid',
          customer: 'cus_1',
          customer_email: 'buyer@example.com',
          payment_intent: 'pi_1',
          invoice: 'in_1',
          metadata: { engagement_id: 'eng_1', price_id: 'price_intro' },
        },
      },
    };
    const first = await postWebhook(app, event);
    const second = await postWebhook(app, event);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(store.paidCount(), 1);
    const engagement = store.getEngagement('eng_1');
    assert.equal(engagement.status, 'paid');
    assert.equal(engagement.customerId, 'cus_1');
  });

  it('does not fulfill a Checkout Session that is still unpaid', async () => {
    const event = {
      id: 'evt_unpaid_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_2',
          payment_status: 'unpaid',
          customer_email: 'buyer@example.com',
          metadata: { engagement_id: 'eng_unpaid' },
        },
      },
    };
    const res = await postWebhook(app, event);
    assert.equal(res.status, 200);
    assert.equal(store.paidCount(), 0);
  });

  it('fulfills a paid Invoice', async () => {
    const event = {
      id: 'evt_invoice_1',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_99',
          customer: 'cus_9',
          customer_email: 'invoice@example.com',
          payment_intent: 'pi_9',
          metadata: { engagement_id: 'eng_inv', price_id: 'price_intro' },
        },
      },
    };
    const res = await postWebhook(app, event);
    assert.equal(res.status, 200);
    assert.equal(store.getEngagement('eng_inv').status, 'paid');
  });

  it('marks an engagement refunded from charge.refunded', async () => {
    store.recordPaidEngagement({
      id: 'eng_1',
      email: 'buyer@example.com',
      paymentIntentId: 'pi_1',
    });
    const res = await postWebhook(app, {
      id: 'evt_refund_1',
      type: 'charge.refunded',
      data: {
        object: {
          object: 'charge',
          id: 'ch_1',
          payment_intent: 'pi_1',
          refunds: { data: [{ id: 're_1' }] },
        },
      },
    });
    assert.equal(res.status, 200);
    assert.equal(store.getEngagement('eng_1').status, 'refunded');
  });

  it('returns 503 when the webhook signing secret is missing', async () => {
    const unconfigured = createApp({
      stripe: {},
      store: createMemoryStore(),
      config: { ...config, webhookSecret: '' },
    });
    const res = await postWebhook(unconfigured, {
      id: 'evt_x',
      type: 'checkout.session.completed',
      data: { object: {} },
    });
    assert.equal(res.status, 503);
  });
});
