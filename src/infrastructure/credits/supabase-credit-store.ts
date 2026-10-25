import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { CreditError } from '../../application/credits/credit-service';
import type { CreditStore, PaymentOrder } from '../../application/credits/credit-ports';

const spendRow = z.object({
  status: z.enum(['reserved', 'captured', 'released', 'insufficient']),
  spend_id: z.string().nullish(), charge: z.enum(['paid', 'free', 'pass']).nullish(),
  cost: z.number().int(), balance: z.number().int(), pass_expires_at: z.string().nullish(), replay: z.boolean(),
});
const orderRow = z.object({
  id: z.string(), user_id: z.string().nullable(), pack_id: z.string(), credits: z.number().int(), amount: z.number().int(),
  currency: z.string(), provider: z.string(), provider_ref: z.string().nullable(), created_at: z.string(),
  status: z.enum(['pending', 'paid', 'expired', 'refunded', 'partially_refunded', 'disputed', 'rejected']),
});
const summaryRow = z.object({
  balance: z.number().int(),
  free_used: z.record(z.string(), z.number().int()),
  passes: z.array(z.object({ feature: z.string(), scope: z.string(), expires_at: z.string() })),
  history: z.array(z.object({ id: z.number().int(), delta: z.number().int(), balance_after: z.number().int(),
    kind: z.enum(['purchase', 'spend', 'refund', 'reversal', 'restore', 'grant', 'transfer']), feature: z.string().nullable(),
    description: z.string(), created_at: z.string() })),
});
const ORDER_FIELDS = 'id,user_id,pack_id,credits,amount,currency,provider,provider_ref,status,created_at';

const toOrder = (row: unknown): PaymentOrder => {
  const o = orderRow.parse(row);
  return { id: o.id, userId: o.user_id, packId: o.pack_id, credits: o.credits, amount: o.amount, currency: o.currency,
    provider: o.provider, providerRef: o.provider_ref, status: o.status, createdAt: o.created_at };
};

/** The credit ledger in Supabase Postgres. Needs a server-side secret key: every function is granted to service_role only. */
export function createSupabaseCreditStore(client: SupabaseClient): CreditStore {
  async function call(fn: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await client.rpc(fn, args);
    if (error?.hint === 'RATE_LIMITED') throw new CreditError('RATE_LIMITED', 'Too many checkouts started.');
    if (error) throw new Error(`Credit store ${fn} failed: ${error.code ?? ''} ${error.message}`);
    return data;
  }
  async function many(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
    const { data, error } = await query;
    if (error) throw new Error('Credit store read failed: ' + error.message);
    return (data ?? []).map(toOrder);
  }
  async function one(query: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
    const { data, error } = await query;
    if (error) throw new Error('Credit store read failed: ' + error.message);
    return data ? toOrder(data) : null;
  }
  return {
    async summary(userId, history) {
      const s = summaryRow.parse(await call('credits_summary', { p_user: userId, p_history: history }));
      return { balance: s.balance, freeUsed: s.free_used,
        passes: s.passes.map(p => ({ feature: p.feature, scope: p.scope, expiresAt: p.expires_at })),
        history: s.history.map(h => ({ id: h.id, delta: h.delta, balanceAfter: h.balance_after, kind: h.kind, feature: h.feature,
          description: h.description, createdAt: h.created_at })) };
    },
    async spend(r) {
      const s = spendRow.parse(await call('credits_spend', { p_user: r.userId, p_feature: r.feature, p_key: r.key, p_cost: r.cost,
        p_free_uses: r.freeUses, p_pass_hours: r.passHours, p_scope_key: r.scope, p_capture: r.capture, p_metadata: r.metadata ?? {} }));
      return { status: s.status, spendId: s.spend_id ?? null, charge: s.charge ?? null, cost: s.cost, balance: s.balance,
        passExpiresAt: s.pass_expires_at ?? null, replay: s.replay };
    },
    async settle(spendId, outcome, metadata = {}) { await call('credits_settle', { p_spend: spendId, p_outcome: outcome, p_metadata: metadata }); },
    async releaseStale(minutes) { return z.number().int().parse(await call('credits_release_stale', { p_older_than_minutes: minutes })); },
    async createOrder(o) {
      return toOrder(await call('credits_create_order', { p_user: o.userId, p_pack: o.packId, p_credits: o.credits, p_amount: o.amount,
        p_currency: o.currency, p_provider: o.provider, p_email: o.email }));
    },
    async attachOrder(orderId, providerRef) { await call('credits_attach_order', { p_order: orderId, p_provider_ref: providerRef }); },
    order: orderId => one(client.from('payment_orders').select(ORDER_FIELDS).eq('id', orderId).maybeSingle()),
    pendingOrders(olderThanMinutes, limit) {
      const now = Date.now(), minutes = (n: number) => new Date(now - n * 60_000).toISOString();
      return many(client.from('payment_orders').select(ORDER_FIELDS).eq('status', 'pending').not('provider_ref', 'is', null)
        .lt('created_at', minutes(olderThanMinutes)).gt('created_at', minutes(48 * 60)).order('created_at', { ascending: false }).limit(limit));
    },
    orderByPayment: (provider, paymentRef) => one(client.from('payment_orders').select(ORDER_FIELDS)
      .eq('provider', provider).eq('provider_payment_ref', paymentRef).maybeSingle()),
    async completeOrder(c) {
      const result = z.object({ result: z.enum(['credited', 'already', 'mismatch', 'unknown']) }).parse(await call('credits_complete_order', {
        p_order: c.orderId, p_provider: c.provider, p_provider_ref: c.providerRef, p_payment_ref: c.paymentRef,
        p_amount: c.amount, p_currency: c.currency, p_email: c.email }));
      return result.result;
    },
    async adjustOrder(orderId, eventId, status, refundedAmount) {
      await call('credits_adjust_order', { p_order: orderId, p_event: eventId, p_status: status, p_refunded_amount: refundedAmount });
    },
    async expireOrder(orderId) { await call('credits_expire_order', { p_order: orderId }); },
    async recordEvent(provider, eventId, type, orderId) {
      return z.boolean().parse(await call('credits_record_event', { p_provider: provider, p_event: eventId, p_type: type, p_order: orderId }));
    },
    async eventProcessed(provider, eventId) { await call('credits_event_processed', { p_provider: provider, p_event: eventId }); },
  };
}
