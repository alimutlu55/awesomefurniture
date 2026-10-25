import type { CreditAccountSummary, CreditStore, LedgerEntry, OrderStatus, PaymentCapture, PaymentOrder, SpendRequest, SpendResult } from '../../application/credits/credit-ports';

interface Spend {
  id: string; userId: string; feature: string; key: string; scope: string | null; cost: number;
  charge: 'paid' | 'free' | 'pass'; status: 'reserved' | 'captured' | 'released'; passExpiresAt: number | null; createdAt: number;
}
interface Order extends PaymentOrder { credited: number; refunded: number; paymentRef: string | null }

/**
 * The credit ledger in memory, with the same rules as the SQL functions in supabase/migrations/*_credits.sql.
 * For tests and local development only: nothing survives a restart. JavaScript runs one call at a time, so each
 * method is as atomic as the locked SQL function it mirrors.
 */
export function createMemoryCreditStore(now: () => number = Date.now): CreditStore & { grant(userId: string, credits: number): void } {
  const balances = new Map<string, number>(), ledger: (LedgerEntry & { userId: string; key: string })[] = [];
  const spends = new Map<string, Spend>(), orders = new Map<string, Order>(), events = new Map<string, boolean>();
  const post = (userId: string, delta: number, kind: LedgerEntry['kind'], key: string, description: string, feature: string | null = null) => {
    if (ledger.some(e => e.userId === userId && e.key === key)) throw new Error('Duplicate ledger key ' + key);
    const balanceAfter = (balances.get(userId) ?? 0) + delta;
    balances.set(userId, balanceAfter);
    ledger.push({ id: ledger.length + 1, userId, key, delta, balanceAfter, kind, feature, description, createdAt: new Date(now()).toISOString() });
    return balanceAfter;
  };
  const result = (s: Spend, replay: boolean): SpendResult => ({ status: s.status, spendId: s.id, charge: s.charge, cost: s.cost,
    balance: balances.get(s.userId) ?? 0, passExpiresAt: s.passExpiresAt ? new Date(s.passExpiresAt).toISOString() : null, replay });
  const live = (s: Spend) => s.status !== 'released';

  function settle(spendId: string, outcome: 'captured' | 'released') {
    const s = spends.get(spendId);
    if (!s) throw new Error('Unknown spend');
    if (s.status !== 'reserved') return;
    s.status = outcome;
    if (outcome === 'released' && s.cost > 0) post(s.userId, s.cost, 'refund', 'refund:' + s.id, s.feature, s.feature);
  }

  return {
    grant(userId, credits) { post(userId, credits, 'grant', 'grant:' + crypto.randomUUID(), 'Test credits'); },
    async summary(userId, history): Promise<CreditAccountSummary> {
      const mine = [...spends.values()].filter(s => s.userId === userId && live(s));
      const freeUsed: Record<string, number> = {};
      for (const s of mine) if (s.charge === 'free') freeUsed[s.feature] = (freeUsed[s.feature] ?? 0) + 1;
      const passes = new Map<string, { feature: string; scope: string; expiresAt: string }>();
      for (const s of mine) if (s.scope && s.passExpiresAt && s.passExpiresAt > now()) {
        const known = passes.get(s.feature + s.scope);
        if (!known || Date.parse(known.expiresAt) < s.passExpiresAt) passes.set(s.feature + s.scope, { feature: s.feature, scope: s.scope, expiresAt: new Date(s.passExpiresAt).toISOString() });
      }
      return { balance: balances.get(userId) ?? 0, freeUsed, passes: [...passes.values()],
        history: ledger.filter(e => e.userId === userId).reverse().slice(0, Math.min(history, 100))
          .map(({ userId: _u, key: _k, ...entry }) => entry) };
    },
    async spend(r: SpendRequest) {
      const existing = [...spends.values()].find(s => s.userId === r.userId && s.key === r.key);
      if (existing) {
        if (existing.feature !== r.feature) throw new Error('Idempotency key reused for another feature');
        return result(existing, true);
      }
      const mine = [...spends.values()].filter(s => s.userId === r.userId && s.feature === r.feature && live(s));
      const pass = r.passHours > 0 ? mine.filter(s => s.scope === r.scope && (s.passExpiresAt ?? 0) > now()).sort((a, b) => b.passExpiresAt! - a.passExpiresAt!)[0] : undefined;
      let charge: Spend['charge'] = 'paid', cost = r.cost, passExpiresAt = r.passHours > 0 ? now() + r.passHours * 3_600_000 : null;
      if (pass) { charge = 'pass'; cost = 0; passExpiresAt = pass.passExpiresAt; }
      else if (mine.filter(s => s.charge === 'free').length < r.freeUses) { charge = 'free'; cost = 0; }
      const balance = balances.get(r.userId) ?? 0;
      if (cost > balance) return { status: 'insufficient', spendId: null, charge: null, cost, balance, passExpiresAt: null, replay: false };
      const s: Spend = { id: crypto.randomUUID(), userId: r.userId, feature: r.feature, key: r.key, scope: r.scope, cost, charge,
        status: r.capture ? 'captured' : 'reserved', passExpiresAt, createdAt: now() };
      spends.set(s.id, s);
      if (cost > 0) post(r.userId, -cost, 'spend', 'spend:' + s.id, r.feature, r.feature);
      return result(s, false);
    },
    async settle(spendId, outcome) { settle(spendId, outcome); },
    async releaseStale(minutes) {
      const stale = [...spends.values()].filter(s => s.status === 'reserved' && s.createdAt < now() - Math.max(minutes, 5) * 60_000);
      stale.forEach(s => settle(s.id, 'released'));
      return stale.length;
    },
    async createOrder(input) {
      const order: Order = { id: crypto.randomUUID(), userId: input.userId, packId: input.packId, credits: input.credits, amount: input.amount,
        currency: input.currency.toLowerCase(), provider: input.provider, providerRef: null, status: 'pending', createdAt: new Date(now()).toISOString(),
        credited: 0, refunded: 0, paymentRef: null };
      orders.set(order.id, order);
      return { ...order };
    },
    async attachOrder(orderId, providerRef) {
      const order = orders.get(orderId);
      if (!order || (order.providerRef && order.providerRef !== providerRef)) throw new Error('Order already has another checkout');
      orders.set(orderId, { ...order, providerRef });
    },
    async order(orderId) { const o = orders.get(orderId); return o ? { ...o } : null; },
    async orderByPayment(provider, paymentRef) {
      const o = [...orders.values()].find(x => x.provider === provider && x.paymentRef === paymentRef);
      return o ? { ...o } : null;
    },
    async completeOrder(c: PaymentCapture) {
      const order = orders.get(c.orderId);
      if (!order || order.provider !== c.provider || (order.providerRef && order.providerRef !== c.providerRef)) return 'unknown';
      if (order.status !== 'pending' && order.status !== 'expired') return 'already';
      if (c.amount !== order.amount || c.currency.toLowerCase() !== order.currency) {
        orders.set(order.id, { ...order, status: 'rejected', paymentRef: c.paymentRef });
        return 'mismatch';
      }
      if (!order.userId) return 'unknown';
      post(order.userId, order.credits, 'purchase', 'order:' + order.id, 'Credit pack');
      orders.set(order.id, { ...order, status: 'paid', credited: order.credits, providerRef: order.providerRef ?? c.providerRef, paymentRef: c.paymentRef });
      return 'credited';
    },
    async adjustOrder(orderId, eventId, status, refundedAmount) {
      const order = orders.get(orderId);
      if (!order || !['paid', 'refunded', 'partially_refunded', 'disputed'].includes(order.status)) return;
      const refunded = Math.min(order.amount, Math.max(order.refunded, refundedAmount ?? 0));
      const target = status === 'disputed' ? 0 : Math.floor(order.credits * (order.amount - refunded) / order.amount);
      const next: OrderStatus = status === 'disputed' ? 'disputed' : refunded >= order.amount ? 'refunded' : refunded > 0 ? 'partially_refunded' : 'paid';
      if (target !== order.credited && order.userId) {
        post(order.userId, target - order.credited, target < order.credited ? 'reversal' : 'restore', `order:${order.id}:${eventId}`,
          target < order.credited ? 'Payment refunded' : 'Payment restored');
      }
      orders.set(orderId, { ...order, status: next, refunded, credited: target });
    },
    async expireOrder(orderId) {
      const order = orders.get(orderId);
      if (order?.status === 'pending') orders.set(orderId, { ...order, status: 'expired' });
    },
    async recordEvent(provider, eventId) {
      const key = provider + ':' + eventId;
      if (!events.has(key)) events.set(key, false);
      return !events.get(key);
    },
    async eventProcessed(provider, eventId) { events.set(provider + ':' + eventId, true); },
  };
}
