function fulfillPaid(store, {
  engagementId,
  email,
  customerId,
  paymentIntentId,
  invoiceId,
  checkoutSessionId,
  priceId,
  source,
}) {
  const id = engagementId || checkoutSessionId || invoiceId;
  if (!id) return null;
  return store.recordPaidEngagement({
    id,
    email,
    customerId,
    paymentIntentId,
    invoiceId,
    checkoutSessionId,
    priceId,
    source,
  });
}

function handleStripeEvent(store, event) {
  if (!store.markEvent(event.id)) {
    return { duplicate: true };
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      if (session.payment_status === 'unpaid') {
        return { fulfilled: false, reason: 'unpaid' };
      }
      fulfillPaid(store, {
        engagementId: session.metadata?.engagement_id,
        email: session.customer_email || session.customer_details?.email,
        customerId: session.customer,
        paymentIntentId: session.payment_intent,
        invoiceId: session.invoice,
        checkoutSessionId: session.id,
        priceId: session.metadata?.price_id,
        source: 'checkout',
      });
      return { fulfilled: true };
    }
    case 'invoice.paid': {
      const invoice = event.data.object;
      fulfillPaid(store, {
        engagementId: invoice.metadata?.engagement_id,
        email: invoice.customer_email,
        customerId: invoice.customer,
        paymentIntentId: invoice.payment_intent,
        invoiceId: invoice.id,
        priceId: invoice.metadata?.price_id,
        source: 'invoice',
      });
      return { fulfilled: true };
    }
    case 'checkout.session.async_payment_failed':
    case 'invoice.payment_failed': {
      const obj = event.data.object;
      const id = obj.metadata?.engagement_id;
      if (id) {
        store.upsertEngagement(id, { status: 'payment_failed' });
      }
      return { fulfilled: false, reason: 'failed' };
    }
    default:
      return { ignored: true };
  }
}

module.exports = { fulfillPaid, handleStripeEvent };
