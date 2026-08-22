const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createMemoryStore } = require('../src/store');

function mockStripe() {
  const sessions = [];
  return {
    sessions,
    checkout: {
      sessions: {
        create: async (params, options) => {
          const session = {
            id: `cs_test_${sessions.length + 1}`,
            url: `https://checkout.stripe.com/c/pay/cs_test_${sessions.length + 1}`,
            params,
            options,
          };
          sessions.push(session);
          return session;
        },
      },
    },
  };
}

async function postJson(app, path, body) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
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
  webhookSecret: 'whsec_test',
  adminApiKey: 'admin_test',
};

describe('POST /api/checkout', () => {
  let store;
  let stripe;
  let app;

  beforeEach(() => {
    store = createMemoryStore();
    stripe = mockStripe();
    app = createApp({ stripe, store, config });
  });

  it('rejects an invalid email', async () => {
    const res = await postJson(app, '/api/checkout', { email: 'not-an-email' });
    assert.equal(res.status, 400);
    assert.equal(stripe.sessions.length, 0);
  });

  it('creates a hosted Checkout Session with the intro Price id, not a client amount', async () => {
    const res = await postJson(app, '/api/checkout', {
      email: 'buyer@example.com',
      name: 'Alex Buyer',
      amount: 1,
    });
    assert.equal(res.status, 200);
    assert.match(res.json.url, /^https:\/\/checkout\.stripe\.com\//);
    const created = stripe.sessions[0];
    assert.equal(created.params.mode, 'payment');
    assert.deepEqual(created.params.line_items, [{ price: 'price_intro', quantity: 1 }]);
    assert.equal(created.params.line_items[0].price_data, undefined);
    assert.equal(created.params.payment_method_types, undefined);
    assert.equal(created.params.invoice_creation.enabled, true);
    assert.equal(created.params.customer_email, 'buyer@example.com');
    assert.match(created.params.integration_identifier, /^cbb-pay-[a-z]{8}$/);
  });

  it('uses the standard Price after the intro cohort is full', async () => {
    for (let i = 0; i < 100; i += 1) {
      store.recordPaidEngagement({ id: `e${i}`, email: `p${i}@example.com` });
    }
    const res = await postJson(app, '/api/checkout', { email: 'late@example.com' });
    assert.equal(res.status, 200);
    assert.equal(stripe.sessions[0].params.line_items[0].price, 'price_standard');
  });
});
