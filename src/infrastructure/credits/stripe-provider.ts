import Stripe from 'stripe';
import { PaymentProviderError, PaymentSignatureError, type PaymentProvider, type PaymentUpdate } from '../../application/credits/credit-ports';

/**
 * Stripe Checkout: Stripe hosts the payment page (cards, Apple Pay, Google Pay, Link and the local methods turned on
 * in the Stripe dashboard), so card data never reaches this app. Credits follow only from a signed webhook or a
 * direct lookup, never from the browser returning to the success page.
 *
 * Stripe turns Managed Payments on by default for new accounts (Stripe becomes the seller and needs a product tax code
 * on every line, or it refuses the session). The packs are priced for a direct sale, so this app turns it off for its
 * sessions unless `managedPayments` is set (`STRIPE_MANAGED_PAYMENTS=true`: then add a tax code and recheck the margins).
 */
export function createStripeProvider(secretKey: string, webhookSecret: string, client?: Stripe, options: { managedPayments?: boolean } = {}): PaymentProvider {
  const stripe = client ?? new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2, timeout: 20_000 });
  const crypto = Stripe.createSubtleCryptoProvider();
  const ref = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id ?? null;

  /** Stripe's error code and type, as a short reference ("authentication_error:api_key_invalid"). */
  function refuse(error: unknown): never {
    const e = error as { rawType?: unknown; type?: unknown; code?: unknown; statusCode?: unknown };
    const part = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_.-]{1,48}$/.test(v) ? v : null;
    throw new PaymentProviderError([part(e.rawType) ?? part(e.type) ?? 'stripe_error', part(e.code) ?? (typeof e.statusCode === 'number' ? 'http_' + e.statusCode : 'unknown')].join(':'));
  }

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
        // Both amounts are the charge's own (tax included, in the currency the customer paid), so their ratio is the share refunded.
        const charge = event.data.object, paymentRef = ref(charge.payment_intent);
        return paymentRef ? { kind: 'refunded', eventId: event.id, paymentRef, refundedAmount: charge.amount_refunded, chargedAmount: charge.amount }
          : { kind: 'ignored', eventId: event.id, type: event.type };
      }
      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        // An inquiry (`warning_*`) also opens as a dispute; closed as `warning_closed` it never became a chargeback, so the credits return.
        const dispute = event.data.object, paymentRef = ref(dispute.payment_intent);
        const stands = dispute.status === 'won' || dispute.status === 'warning_closed';
        if (!paymentRef || (event.type === 'charge.dispute.closed' && !stands)) return { kind: 'ignored', eventId: event.id, type: event.type };
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
        managed_payments: { enabled: options.managedPayments === true },
        client_reference_id: order.id,
        ...(email ? { customer_email: email } : {}),
        line_items: [{ quantity: 1, price_data: { currency: order.currency, unit_amount: order.amount,
          product_data: { name: label, description: 'Credits for AI images and technical drawings in Wardrobe Forge.' } } }],
        metadata: { order_id: order.id, pack: order.packId },
        payment_intent_data: { metadata: { order_id: order.id, pack: order.packId } },
        success_url: links.success.replace('{ORDER}', order.id),
        cancel_url: links.cancel.replace('{ORDER}', order.id),
      }, { idempotencyKey: 'checkout:' + order.id }).catch(refuse);
      if (!session.url) throw new Error('Stripe returned no checkout page.');
      return { url: session.url, providerRef: session.id };
    },
    async lookup(order) {
      if (!order.providerRef) return null;
      const session = await stripe.checkout.sessions.retrieve(order.providerRef).catch(refuse);
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
