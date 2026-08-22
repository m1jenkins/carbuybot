const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createMemoryStore } = require('../src/store');

function mockStripe() {
  const calls = { customers: [], invoiceItems: [], invoices: [], finalized: [], sent: [], options: [] };
  let customerN = 0;
  let invoiceN = 0;
  return {
    calls,
    customers: {
      create: async (params, options) => {
        customerN += 1;
        const customer = { id: `cus_${customerN}`, ...params };
        calls.customers.push(params);
        calls.options.push(['customer', options]);
        return customer;
      },
    },
    invoiceItems: {
      create: async (params, options) => {
        calls.invoiceItems.push(params);
        calls.options.push(['invoiceitem', options]);
        return { id: 'ii_1', ...params };
      },
    },
    invoices: {
      create: async (params, options) => {
        invoiceN += 1;
        const invoice = {
          id: `in_${invoiceN}`,
          hosted_invoice_url: `https://invoice.stripe.com/i/in_${invoiceN}`,
          invoice_pdf: `https://pay.stripe.com/invoice/in_${invoiceN}/pdf`,
          status: 'draft',
          ...params,
        };
        calls.invoices.push(params);
        calls.options.push(['invoice', options]);
        return invoice;
      },
      finalizeInvoice: async (id) => {
        calls.finalized.push(id);
        return { id, status: 'open', hosted_invoice_url: `https://invoice.stripe.com/i/${id}` };
      },
      sendInvoice: async (id) => {
        calls.sent.push(id);
        return { id, status: 'open', hosted_invoice_url: `https://invoice.stripe.com/i/${id}` };
      },
    },
  };
}

async function postJson(app, path, body, headers = {}) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
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

describe('POST /api/invoices', () => {
  let store;
  let stripe;
  let app;

  beforeEach(() => {
    store = createMemoryStore();
    stripe = mockStripe();
    app = createApp({ stripe, store, config });
  });

  it('requires the admin key', async () => {
    const res = await postJson(app, '/api/invoices', { email: 'buyer@example.com' });
    assert.equal(res.status, 401);
  });

  it('creates a send_invoice Invoice on a Customer using a Price id', async () => {
    const res = await postJson(
      app,
      '/api/invoices',
      { email: 'buyer@example.com', name: 'Alex Buyer' },
      { 'x-admin-key': 'admin_test' },
    );
    assert.equal(res.status, 200);
    assert.ok(res.json.hostedInvoiceUrl);
    assert.equal(stripe.calls.customers[0].email, 'buyer@example.com');
    assert.equal(stripe.calls.invoiceItems[0].pricing.price, 'price_intro');
    assert.equal(stripe.calls.invoiceItems[0].price, undefined);
    assert.equal(stripe.calls.invoiceItems[0].customer, 'cus_1');
    assert.match(stripe.calls.invoiceItems[0].description, /CarBuyerBots/);
    assert.equal(stripe.calls.options[0][1].idempotencyKey.startsWith('customer:'), true);
    assert.equal(stripe.calls.invoices[0].collection_method, 'send_invoice');
    assert.equal(stripe.calls.invoices[0].days_until_due, 7);
    assert.equal(stripe.calls.invoices[0].payment_method_types, undefined);
    assert.deepEqual(stripe.calls.finalized, ['in_1']);
    assert.deepEqual(stripe.calls.sent, ['in_1']);
  });
});
