import Stripe from 'stripe';
import { PaymentSignatureError, type PaymentProvider, type PaymentUpdate } from '../../application/credits/credit-ports';

/**
 * Stripe Checkout: Stripe hosts the payment page (cards, Apple Pay, Google Pay, Link and the local methods turned on
 * in the Stripe dashboard), so card data never reaches this app. Credits follow only from a signed webhook or a
 * direct lookup, never from the browser returning to the success page.
 */
export function createStripeProvider(secretKey: string, webhookSecret: string, client?: Stripe): PaymentProvider {
  const stripe = client ?? new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2, timeout: 20_000 });
  const crypto = Stripe.createSubtleCryptoProvider();
  const ref = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id ?? null;

  function fromSession(eventId: string, session: Stripe.Checkout.Session, paid: boolean): PaymentUpdate {
    const orderId = session.client_reference_id ?? session.metadata?.order_id;
    if (!orderId) return { kind: 'ignored', eventId, type: 'checkout.session.without-order' };
    if (session.status === 'expired') return { kind: 'expired', eventId, orderId };
    if (!paid || session.payment_status !== 'paid') return { kind: 'pending', eventId, orderId };
    return { kind: 'paid', eventId, capture: { orderId, provider: 'stripe', providerRef: session.id, paymentRef: ref(session.payment_intent),
      // The subtotal is the pack price before any tax Stripe Tax adds on top.
      amount: session.amount_subtotal ?? -1, currency: session.currency ?? '', email: session.customer_details?.email ?? null } };
  }

  function read(event: Stripe.Event): PaymentUpdate {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return fromSession(event.id, event.data.object, true);
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const orderId = event.data.object.client_reference_id;
        return orderId ? { kind: 'expired', eventId: event.id, orderId } : { kind: 'ignored', eventId: event.id, type: event.type };
      }
      case 'charge.refunded': {
        const paymentRef = ref(event.data.object.payment_intent);
        return paymentRef ? { kind: 'refunded', eventId: event.id, paymentRef, refundedAmount: event.data.object.amount_refunded }
          : { kind: 'ignored', eventId: event.id, type: event.type };
      }
      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        const dispute = event.data.object, paymentRef = ref(dispute.payment_intent);
        if (!paymentRef || (event.type === 'charge.dispute.closed' && dispute.status !== 'won')) return { kind: 'ignored', eventId: event.id, type: event.type };
        return { kind: event.type === 'charge.dispute.created' ? 'disputed' : 'dispute_won', eventId: event.id, paymentRef };
      }
      default:
        return { kind: 'ignored', eventId: event.id, type: event.type };
    }
  }

  return {
    id: 'stripe',
    async checkout(order, links, email, label) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: order.id,
        ...(email ? { customer_email: email } : {}),
        line_items: [{ quantity: 1, price_data: { currency: order.currency, unit_amount: order.amount,
          product_data: { name: label, description: 'Credits for AI images and technical drawings in Wardrobe Forge.' } } }],
        metadata: { order_id: order.id, pack: order.packId },
        payment_intent_data: { metadata: { order_id: order.id, pack: order.packId } },
        success_url: links.success.replace('{ORDER}', order.id),
        cancel_url: links.cancel.replace('{ORDER}', order.id),
      }, { idempotencyKey: 'checkout:' + order.id });
      if (!session.url) throw new Error('Stripe returned no checkout page.');
      return { url: session.url, providerRef: session.id };
    },
    async lookup(order) {
      if (!order.providerRef) return null;
      const session = await stripe.checkout.sessions.retrieve(order.providerRef);
      if (session.status === 'open') return null;
      return fromSession(`lookup:${session.id}:${session.status}:${session.payment_status}`, session, session.status === 'complete');
    },
    async webhook(body, headers) {
      const signature = headers.get('stripe-signature');
      if (!signature) throw new PaymentSignatureError();
      let event: Stripe.Event;
      try { event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, 300, crypto); }
      catch { throw new PaymentSignatureError(); }
      return read(event);
    },
  };
}
