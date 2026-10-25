import { PaymentSignatureError, type PaymentProvider } from '../../application/credits/credit-ports';

/**
 * A pretend checkout for local development and automated browser checks: a page on this server with Pay and Cancel.
 * Only `CREDITS_MODE=test` turns it on (credit-environment.ts), and test mode never touches the real ledger.
 * Its webhook is signed with a per-process secret, so even in test mode a browser cannot credit itself.
 */
export function createTestPaymentProvider(origin: string, secret = crypto.randomUUID()): PaymentProvider & { secret: string } {
  return {
    id: 'test',
    secret,
    async checkout(order, links) {
      const url = new URL('/api/payments/test/checkout', origin);
      url.searchParams.set('order', order.id);
      url.searchParams.set('success', links.success.replace('{ORDER}', order.id));
      url.searchParams.set('cancel', links.cancel.replace('{ORDER}', order.id));
      return { url: url.href, providerRef: 'test_' + order.id };
    },
    async lookup() { return null; },
    async webhook(body, headers) {
      if (headers.get('x-test-signature') !== secret) throw new PaymentSignatureError();
      const event = JSON.parse(body) as { id: string; order: { id: string; amount: number; currency: string }; outcome: 'paid' | 'expired' };
      if (event.outcome === 'expired') return { kind: 'expired', eventId: event.id, orderId: event.order.id };
      return { kind: 'paid', eventId: event.id, capture: { orderId: event.order.id, provider: 'test', providerRef: 'test_' + event.order.id,
        paymentRef: 'test_payment_' + event.order.id, amount: event.order.amount, currency: event.order.currency, email: null } };
    },
  };
}
