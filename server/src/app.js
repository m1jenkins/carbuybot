const path = require('node:path');
const express = require('express');
const Stripe = require('stripe');
const { handleStripeEvent } = require('./fulfill');
const { secretsEqual } = require('./auth');
const {
  isValidEmail,
  randomLetters,
  newEngagementId,
  selectPriceId,
  priceLabel,
} = require('./pricing');

const INVOICE_ITEM_DESCRIPTION = 'CarBuyerBots car buying engagement — one vehicle';

function createApp({ stripe, store, config, staticRoot }) {
  const app = express();

  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    (req, res) => {
      if (!config.webhookSecret) {
        return res.status(503).json({ error: 'Webhook signing secret is not configured' });
      }
      const signature = req.headers['stripe-signature'];
      let event;
      try {
        event = Stripe.webhooks.constructEvent(req.body, signature, config.webhookSecret);
      } catch {
        return res.status(400).json({ error: 'Invalid Stripe signature' });
      }
      handleStripeEvent(store, event);
      return res.json({ received: true });
    },
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/checkout', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim();
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (!config.introPriceId || !config.standardPriceId) {
      return res.status(503).json({ error: 'Stripe catalog is not configured' });
    }

    const priceId = selectPriceId(store, config);
    const engagement = store.createEngagement({
      id: newEngagementId(),
      email,
      name,
      status: 'checkout_created',
      priceId,
      priceLabel: priceLabel(priceId, config),
      createdAt: new Date().toISOString(),
    });

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          customer_email: email,
          customer_creation: 'always',
          line_items: [{ price: priceId, quantity: 1 }],
          invoice_creation: { enabled: true },
          success_url: `${config.publicBaseUrl}/pay/success.html?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${config.publicBaseUrl}/pay/cancel.html`,
          client_reference_id: engagement.id,
          metadata: {
            engagement_id: engagement.id,
            price_id: priceId,
            product: 'car_buying_engagement',
          },
          integration_identifier: `cbb-pay-${randomLetters(8)}`,
        },
        { idempotencyKey: `checkout:${engagement.id}` },
      );
      store.upsertEngagement(engagement.id, { checkoutSessionId: session.id });
      return res.json({ url: session.url, engagementId: engagement.id });
    } catch (err) {
      console.error('checkout create failed:', err.message);
      store.upsertEngagement(engagement.id, { status: 'checkout_failed' });
      return res.status(502).json({ error: 'Unable to start Checkout' });
    }
  });

  app.post('/api/invoices', async (req, res) => {
    if (!secretsEqual(req.headers['x-admin-key'], config.adminApiKey)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim();
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const priceId = selectPriceId(store, config);
    const engagement = store.createEngagement({
      id: newEngagementId(),
      email,
      name,
      status: 'invoice_created',
      priceId,
      priceLabel: priceLabel(priceId, config),
      createdAt: new Date().toISOString(),
    });

    try {
      const customer = await stripe.customers.create(
        {
          email,
          name: name || undefined,
          metadata: { engagement_id: engagement.id },
        },
        { idempotencyKey: `customer:${engagement.id}` },
      );
      await stripe.invoiceItems.create(
        {
          customer: customer.id,
          pricing: { price: priceId },
          quantity: 1,
          description: INVOICE_ITEM_DESCRIPTION,
        },
        { idempotencyKey: `invoiceitem:${engagement.id}` },
      );
      const invoice = await stripe.invoices.create(
        {
          customer: customer.id,
          collection_method: 'send_invoice',
          days_until_due: 7,
          pending_invoice_items_behavior: 'include',
          metadata: {
            engagement_id: engagement.id,
            price_id: priceId,
            product: 'car_buying_engagement',
          },
        },
        { idempotencyKey: `invoice:${engagement.id}` },
      );
      await stripe.invoices.finalizeInvoice(invoice.id, undefined, {
        idempotencyKey: `invoice-finalize:${engagement.id}`,
      });
      const sent = await stripe.invoices.sendInvoice(invoice.id, undefined, {
        idempotencyKey: `invoice-send:${engagement.id}`,
      });
      store.upsertEngagement(engagement.id, {
        customerId: customer.id,
        invoiceId: invoice.id,
        status: 'invoice_sent',
      });
      return res.json({
        invoiceId: invoice.id,
        hostedInvoiceUrl: sent.hosted_invoice_url,
        engagementId: engagement.id,
      });
    } catch (err) {
      console.error('invoice create failed:', err.message);
      store.upsertEngagement(engagement.id, { status: 'invoice_failed' });
      return res.status(502).json({ error: 'Unable to send invoice' });
    }
  });

  app.post('/api/admin/refunds', async (req, res) => {
    if (!secretsEqual(req.headers['x-admin-key'], config.adminApiKey)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const engagementId = String(req.body?.engagementId || '').trim();
    const engagement = store.getEngagement(engagementId);
    if (!engagement?.paymentIntentId) {
      return res.status(404).json({ error: 'Paid engagement not found' });
    }
    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: engagement.paymentIntentId,
          reason: 'requested_by_customer',
          metadata: {
            engagement_id: engagementId,
            guarantee: 'save_more_than_fee_or_free',
          },
        },
        { idempotencyKey: `refund:${engagementId}` },
      );
      store.upsertEngagement(engagementId, { status: 'refunded', refundId: refund.id });
      return res.json({ refundId: refund.id });
    } catch {
      return res.status(502).json({ error: 'Unable to refund' });
    }
  });

  if (staticRoot) {
    app.use(express.static(staticRoot));
  }

  const payDir = path.join(__dirname, '..', 'public');
  app.use('/pay', express.static(payDir));

  return app;
}

module.exports = { createApp, INVOICE_ITEM_DESCRIPTION };
