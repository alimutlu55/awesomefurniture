import { CREDIT_FEATURES, CREDIT_PACKS, creditFeature, creditPack, packCredits, packSaving, type CreditFeature } from '../../domain/credits/credit-catalog';
import type { CheckoutLinks, CreditStore, CreditUser, PaymentProvider, PaymentUpdate, SpendResult } from './credit-ports';
import type { CreditWallet, OrderConfirmation } from './credit-wallet';

export type CreditErrorCode = 'UNKNOWN_PACK' | 'UNKNOWN_PROVIDER' | 'UNKNOWN_FEATURE' | 'ACCOUNT_REQUIRED' | 'INSUFFICIENT_CREDITS'
  | 'ORDER_NOT_FOUND' | 'INVALID_REQUEST' | 'SIGN_IN_REQUIRED' | 'CREDITS_UNAVAILABLE';

/** A request the credit service refuses; the code is what the browser maps to its own copy. */
export class CreditError extends Error {
  constructor(readonly code: CreditErrorCode, message: string, readonly detail: { cost?: number; balance?: number } = {}) { super(message); }
}

const KEY = /^[A-Za-z0-9:_-]{8,200}$/;
const SCOPE = /^[A-Za-z0-9:_.-]{1,200}$/;

interface Dependencies {
  store: CreditStore;
  /** Payment providers by id; the first is offered first. */
  providers: readonly PaymentProvider[];
  /** Buying needs an email-verified account, so paid credits survive a cleared browser and reach every device. */
  requireAccount: boolean;
}

/** Buying, spending and reading credits. Prices come only from the catalog; the store keeps every change. */
export function createCreditService({ store, providers, requireAccount }: Dependencies) {
  const provider = (id: string) => providers.find(p => p.id === id);
  const feature = (key: string, settlement: CreditFeature['settlement']) => {
    const found = creditFeature(key);
    if (!found || found.settlement !== settlement) throw new CreditError('UNKNOWN_FEATURE', 'This feature cannot be charged here.');
    return found;
  };
  const refuseShort = (result: SpendResult) => {
    if (result.status === 'insufficient') {
      throw new CreditError('INSUFFICIENT_CREDITS', 'Not enough credits.', { cost: result.cost, balance: result.balance });
    }
    return result;
  };

  async function wallet(user: CreditUser): Promise<CreditWallet> {
    const summary = await store.summary(user.id, 30);
    return {
      balance: summary.balance,
      account: { anonymous: user.anonymous, email: user.email, required: requireAccount },
      features: CREDIT_FEATURES.map(f => ({ key: f.key, label: f.label, description: f.description, unit: f.unit, icon: f.icon,
        cost: f.cost, passHours: f.passHours,
        freeLeft: Math.max(0, f.freeUses - (summary.freeUsed[f.key] ?? 0)) })),
      packs: CREDIT_PACKS.map(p => ({ id: p.id, label: p.label, credits: p.credits, bonus: p.bonus, total: packCredits(p),
        price: p.price, currency: p.currency, featured: 'featured' in p && p.featured === true, saving: packSaving(p) })),
      providers: providers.map(p => p.id),
      passes: summary.passes,
      history: summary.history,
    };
  }

  async function checkout(user: CreditUser, input: { pack: unknown; provider: unknown; links: CheckoutLinks }) {
    const pack = typeof input.pack === 'string' ? creditPack(input.pack) : undefined;
    if (!pack) throw new CreditError('UNKNOWN_PACK', 'Choose one of the credit packs.');
    const via = typeof input.provider === 'string' ? provider(input.provider) : providers[0];
    if (!via) throw new CreditError('UNKNOWN_PROVIDER', 'This payment method is not available.');
    if (requireAccount && (user.anonymous || !user.email)) throw new CreditError('ACCOUNT_REQUIRED', 'Add your email before buying credits.');
    const order = await store.createOrder({ userId: user.id, packId: pack.id, credits: packCredits(pack), amount: pack.price,
      currency: pack.currency, provider: via.id, email: user.email });
    const session = await via.checkout(order, input.links, user.email, `${pack.label} pack · ${packCredits(pack)} credits`);
    await store.attachOrder(order.id, session.providerRef);
    return { orderId: order.id, url: session.url };
  }

  /** Applies one verified provider update, once: a replayed event is skipped. */
  async function apply(via: PaymentProvider, update: PaymentUpdate) {
    const order = update.kind === 'paid' ? await store.order(update.capture.orderId)
      : update.kind === 'expired' || update.kind === 'pending' ? await store.order(update.orderId)
        : update.kind === 'ignored' ? null : await store.orderByPayment(via.id, update.paymentRef);
    if (!await store.recordEvent(via.id, update.eventId, update.kind, order?.id ?? null)) return 'replay' as const;
    if (update.kind === 'paid') await store.completeOrder(update.capture);
    else if (update.kind === 'expired' && order) await store.expireOrder(order.id);
    else if (update.kind === 'refunded' && order) await store.adjustOrder(order.id, update.eventId, 'refunded', update.refundedAmount);
    else if ((update.kind === 'disputed' || update.kind === 'dispute_won') && order) await store.adjustOrder(order.id, update.eventId, update.kind, null);
    await store.eventProcessed(via.id, update.eventId);
    return 'applied' as const;
  }

  /** A signed notification from a provider. Throws PaymentSignatureError for anything not from it. */
  async function receive(providerId: string, body: string, headers: { get(name: string): string | null }) {
    const via = provider(providerId);
    if (!via) throw new CreditError('UNKNOWN_PROVIDER', 'Unknown payment provider.');
    return apply(via, await via.webhook(body, headers));
  }

  /** The person came back from checkout: if the webhook has not arrived yet, ask the provider directly. */
  async function confirm(user: CreditUser, orderId: unknown): Promise<OrderConfirmation> {
    let order = typeof orderId === 'string' && /^[0-9a-f-]{36}$/.test(orderId) ? await store.order(orderId) : null;
    if (!order || order.userId !== user.id) throw new CreditError('ORDER_NOT_FOUND', 'This purchase was not found.');
    const via = provider(order.provider);
    if (order.status === 'pending' && via) {
      const update = await via.lookup(order);
      if (update) { await apply(via, update); order = await store.order(order.id) ?? order; }
    }
    const { balance } = await store.summary(user.id, 0);
    return { orderId: order.id, status: order.status, credits: order.credits, balance };
  }

  /** Uses a feature that is final when used (technical drawings). */
  async function spend(user: CreditUser, input: { feature: unknown; key: unknown; scope: unknown }) {
    const f = feature(String(input.feature), 'immediate');
    if (typeof input.key !== 'string' || !KEY.test(input.key)) throw new CreditError('INVALID_REQUEST', 'A request key is required.');
    const scope = typeof input.scope === 'string' && SCOPE.test(input.scope) ? input.scope : null;
    if (f.passHours > 0 && !scope) throw new CreditError('INVALID_REQUEST', 'Say which design this is for.');
    return refuseShort(await store.spend({ userId: user.id, feature: f.key, key: `${f.key}:${input.key}`, cost: f.cost, freeUses: f.freeUses,
      passHours: f.passHours, scope, capture: true }));
  }

  /** Reserves a feature whose result may fail (an AI image); settle it with `settle` either way. */
  async function reserve(user: CreditUser, featureKey: string, key: string, metadata: Readonly<Record<string, string | number | boolean>> = {}) {
    const f = feature(featureKey, 'result');
    if (!KEY.test(key)) throw new CreditError('INVALID_REQUEST', 'A request key is required.');
    return refuseShort(await store.spend({ userId: user.id, feature: f.key, key: `${f.key}:${key}`, cost: f.cost, freeUses: f.freeUses,
      passHours: f.passHours, scope: null, capture: false, metadata }));
  }

  return {
    wallet, checkout, receive, confirm, spend, reserve,
    settle: (spendId: string, outcome: 'captured' | 'released', metadata?: Readonly<Record<string, string | number | boolean | null>>) =>
      store.settle(spendId, outcome, metadata),
    releaseStale: () => store.releaseStale(15),
  };
}
export type CreditService = ReturnType<typeof createCreditService>;
