import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { CREDIT_FEATURES, CREDIT_PACKS, creditPack, packCredits, packSaving } from '../../src/domain/credits/credit-catalog';
import { featureMargins, MINIMUM_MARGIN, packRevenue } from '../../src/domain/credits/unit-economics';
import { IMAGE_REQUEST_TOKENS, imageGenerationCost } from '../../src/domain/credits/image-generation-cost';
import { createCreditService, CreditError } from '../../src/application/credits/credit-service';
import { PaymentProviderError, PaymentSignatureError, type CreditUser, type PaymentProvider, type PaymentUpdate } from '../../src/application/credits/credit-ports';
import { createMemoryCreditStore } from '../../src/infrastructure/credits/memory-credit-store';
import { createStripeProvider } from '../../src/infrastructure/credits/stripe-provider';
import { featureCharge } from '../../src/infrastructure/credits/image-charge';
import type { CreditRuntime } from '../../src/infrastructure/credits/credit-environment';
import { handleApi } from '../../src/app/api-router';
import { handleCredits } from '../../src/infrastructure/credits/credit-http';

const buyer: CreditUser = { id: 'b0000000-0000-4000-8000-000000000001', anonymous: false, email: 'buyer@example.test' };
const guest: CreditUser = { id: 'b0000000-0000-4000-8000-000000000002', anonymous: true, email: null };
const links = { success: 'https://app.test/editor.html?checkout=success&order={ORDER}', cancel: 'https://app.test/editor.html?checkout=cancel&order={ORDER}' };
const POPULAR = packCredits(creditPack('popular')!), STARTER = packCredits(creditPack('starter')!);

/** A provider whose webhooks are whatever the test says, as if Stripe had signed them. */
function fakeProvider() {
  const updates: PaymentUpdate[] = [];
  let lookup: PaymentUpdate | null = null;
  const provider: PaymentProvider = {
    id: 'fake',
    async checkout(order) { return { url: 'https://pay.test/' + order.id, providerRef: 'cs_' + order.id }; },
    async lookup() { return lookup; },
    async webhook(body) { if (body !== 'signed') throw new PaymentSignatureError(); return updates.shift()!; },
  };
  return { provider, push: (u: PaymentUpdate) => updates.push(u), setLookup: (u: PaymentUpdate | null) => { lookup = u; } };
}
function setup(requireAccount = true) {
  const store = createMemoryCreditStore(), fake = fakeProvider();
  const service = createCreditService({ store, providers: [fake.provider], requireAccount });
  const paid = (orderId: string, eventId: string, amount = 999): PaymentUpdate => ({ kind: 'paid', eventId,
    capture: { orderId, provider: 'fake', providerRef: 'cs_' + orderId, paymentRef: 'pi_' + orderId, amount, currency: 'usd', email: null } });
  return { store, service, fake, paid, headers: new Headers() };
}

test('every paid feature keeps its margin at the cheapest credit when the provider costs the most', () => {
  for (const feature of CREDIT_FEATURES) {
    for (const m of featureMargins(feature)) {
      assert.ok(m.typical >= MINIMUM_MARGIN.typical, `${feature.key} on the ${m.pack} pack usually keeps ${(m.typical * 100).toFixed(0)}%`);
      assert.ok(m.worst >= MINIMUM_MARGIN.worst, `${feature.key} on the ${m.pack} pack keeps ${(m.worst * 100).toFixed(0)}% at worst`);
    }
  }
  assert.equal(new Set(CREDIT_FEATURES.map(f => f.key)).size, CREDIT_FEATURES.length);
  const perCredit = CREDIT_PACKS.map(p => p.price / packCredits(p));
  assert.ok(perCredit.every((price, i) => i === 0 || price < perCredit[i - 1]!), 'a bigger pack is always cheaper per credit');
  assert.deepEqual(CREDIT_PACKS.map(packSaving), [0, 9, 17, 20]);
  assert.ok(CREDIT_PACKS.every(p => packCredits(p) % 5 === 0), 'credit amounts stay round');
  const image = CREDIT_FEATURES.find(f => f.key === 'ai-image')!;
  assert.ok(CREDIT_PACKS.every(p => packCredits(p) % image.cost === 0), 'every pack buys whole AI images');
  assert.equal(CREDIT_PACKS.filter(p => 'featured' in p && p.featured).length, 1);
});

test('a paid order is credited once, however often the provider repeats it, and only for the right amount', async () => {
  const { service, fake, paid, headers } = setup();
  const { orderId, url } = await service.checkout(buyer, { pack: 'popular', provider: 'fake', links });
  assert.equal(url, 'https://pay.test/' + orderId);
  fake.push(paid(orderId, 'evt_1')); fake.push(paid(orderId, 'evt_1')); fake.push(paid(orderId, 'evt_2'));
  assert.equal(await service.receive('fake', 'signed', headers), 'applied');
  assert.equal(await service.receive('fake', 'signed', headers), 'replay');
  await service.receive('fake', 'signed', headers);
  assert.equal((await service.wallet(buyer)).balance, POPULAR);
  await assert.rejects(service.receive('fake', 'forged', headers), PaymentSignatureError);

  const short = await service.checkout(buyer, { pack: 'starter', provider: 'fake', links });
  fake.push(paid(short.orderId, 'evt_3', 1));
  await service.receive('fake', 'signed', headers);
  assert.equal((await service.wallet(buyer)).balance, POPULAR, 'a payment of the wrong amount credits nothing');
  assert.equal((await service.confirm(buyer, short.orderId)).status, 'rejected');
});

test('returning from checkout before the webhook asks the provider, and nobody else can read the order', async () => {
  const { service, fake, paid } = setup();
  const { orderId } = await service.checkout(buyer, { pack: 'starter', provider: 'fake', links });
  assert.equal((await service.confirm(buyer, orderId)).status, 'pending');
  fake.setLookup(paid(orderId, 'lookup_1', 499));
  assert.deepEqual(await service.confirm(buyer, orderId), { orderId, status: 'paid', credits: STARTER, balance: STARTER });
  await assert.rejects(service.confirm({ ...buyer, id: 'b0000000-0000-4000-8000-000000000009' }, orderId), /not found/);
});

test('buying needs a verified email unless the operator turns that off; prices come only from the catalog', async () => {
  const { service } = setup();
  await assert.rejects(service.checkout(guest, { pack: 'starter', provider: 'fake', links }), (e: CreditError) => e.code === 'ACCOUNT_REQUIRED');
  await assert.rejects(service.checkout(buyer, { pack: 'free-money', provider: 'fake', links }), (e: CreditError) => e.code === 'UNKNOWN_PACK');
  const open = setup(false);
  assert.ok((await open.service.checkout(guest, { pack: 'starter', provider: 'fake', links })).orderId);
});

test('refunds and chargebacks take credits back; a won dispute gives them back', async () => {
  const { service, store, fake, paid, headers } = setup();
  const { orderId } = await service.checkout(buyer, { pack: 'popular', provider: 'fake', links });
  fake.push(paid(orderId, 'evt_paid'));
  await service.receive('fake', 'signed', headers);
  await service.spend(buyer, { feature: 'technical-drawings', key: 'open-0000001', scope: 'design-1' });
  fake.push({ kind: 'refunded', eventId: 'evt_refund', paymentRef: 'pi_' + orderId, refundedAmount: 999, chargedAmount: 999 });
  await service.receive('fake', 'signed', headers);
  assert.equal((await service.wallet(buyer)).balance, 0, 'the free drawings cost nothing; the refund takes the whole pack');
  fake.push({ kind: 'disputed', eventId: 'evt_dispute', paymentRef: 'pi_' + orderId });
  await service.receive('fake', 'signed', headers);
  assert.equal((await store.order(orderId))!.status, 'disputed');
  assert.equal((await service.wallet(buyer)).balance, 0, 'a dispute on a refunded order takes nothing a second time');
});

test('technical drawings: the first set is free, the same design stays free for its pass, another design pays', async () => {
  const { service, store } = setup();
  const use = (key: string, scope: string) => service.spend(buyer, { feature: 'technical-drawings', key, scope });
  assert.equal((await service.wallet(buyer)).features.find(f => f.key === 'technical-drawings')!.freeLeft, 1);
  assert.equal((await use('drawings-0001', 'design-a')).charge, 'free');
  assert.equal((await use('drawings-0002', 'design-a')).charge, 'pass');
  await assert.rejects(use('drawings-0003', 'design-b'), (e: CreditError) => e.code === 'INSUFFICIENT_CREDITS' && e.detail.cost === 10 && e.detail.balance === 0);
  store.grant(buyer.id, 25);
  assert.deepEqual([(await use('drawings-0004', 'design-b')).charge, (await use('drawings-0004', 'design-b')).balance], ['paid', 15]);
  await assert.rejects(service.spend(buyer, { feature: 'ai-image', key: 'drawings-0005', scope: 'x' }), (e: CreditError) => e.code === 'UNKNOWN_FEATURE',
    'an AI image is charged only by its own endpoint, where a failed result is refunded');
});

test('an AI image reserves its credits, keeps them when the image arrives and refunds them when it fails', async () => {
  const { service, store } = setup();
  // Enough for two images and a little over: the third is refused.
  const cost = CREDIT_FEATURES.find(f => f.key === 'ai-image')!.cost;
  store.grant(buyer.id, cost * 2 + 2);
  const runtime: CreditRuntime = { mode: 'test', service, authenticate: async request => request.headers.get('authorization') ? buyer : null, test: null };
  const charge = featureCharge(runtime, 'ai-image');
  const request = (key: string) => new Request('https://app.test/api/design-images', { headers: { authorization: 'Bearer x', 'idempotency-key': key } });
  const kept = await charge.begin(request('image-attempt-1'));
  assert.equal(kept.balance, cost + 2);
  await kept.commit({ total_tokens: 12000 });
  const failed = await charge.begin(request('image-attempt-2'));
  await failed.refund('PROVIDER_ERROR');
  assert.equal((await service.wallet(buyer)).balance, cost + 2);
  await assert.rejects(charge.begin(request('image-attempt-1')), /already received/, 'a retried request never runs the provider twice');
  await charge.begin(request('image-attempt-3'));
  await assert.rejects(charge.begin(request('image-attempt-4')), (e: CreditError) => e.code === 'INSUFFICIENT_CREDITS');
  await assert.rejects(charge.begin(new Request('https://app.test/api/design-images')), (e: CreditError) => e.code === 'SIGN_IN_REQUIRED');
  await assert.rejects(featureCharge(null, 'ai-image').begin(request('image-attempt-5')), (e: CreditError) => e.code === 'CREDITS_UNAVAILABLE');
});

test('Stripe webhooks are verified, and checkout, refund and dispute events become updates', async () => {
  const secret = 'whsec_test_secret', stripe = new Stripe('sk_test_unused', { httpClient: Stripe.createFetchHttpClient() });
  const provider = createStripeProvider('sk_test_unused', secret, stripe);
  const send = async (type: string, object: object, signWith = secret) => {
    const body = JSON.stringify({ id: 'evt_' + type, object: 'event', type, data: { object } });
    const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload: body, secret: signWith, cryptoProvider: Stripe.createSubtleCryptoProvider() });
    return provider.webhook(body, new Headers({ 'stripe-signature': header }));
  };
  const session = { id: 'cs_1', object: 'checkout.session', client_reference_id: 'order-1', status: 'complete', payment_status: 'paid',
    payment_intent: 'pi_1', amount_subtotal: 999, amount_total: 1189, currency: 'usd', customer_details: { email: 'buyer@example.test' } };
  assert.deepEqual(await send('checkout.session.completed', session), { kind: 'paid', eventId: 'evt_checkout.session.completed',
    capture: { orderId: 'order-1', provider: 'stripe', providerRef: 'cs_1', paymentRef: 'pi_1', amount: 999, currency: 'usd', email: 'buyer@example.test' } });
  assert.equal((await send('checkout.session.completed', { ...session, payment_status: 'unpaid' })).kind, 'pending', 'a bank transfer still on its way');
  assert.deepEqual(await send('charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', amount: 1189, amount_refunded: 500 }),
    { kind: 'refunded', eventId: 'evt_charge.refunded', paymentRef: 'pi_1', refundedAmount: 500, chargedAmount: 1189 });
  assert.equal((await send('charge.dispute.closed', { id: 'dp_1', payment_intent: 'pi_1', status: 'won' })).kind, 'dispute_won');
  assert.equal((await send('charge.dispute.closed', { id: 'dp_1', payment_intent: 'pi_1', status: 'lost' })).kind, 'ignored');
  assert.equal((await send('charge.dispute.closed', { id: 'dp_2', payment_intent: 'pi_1', status: 'warning_closed' })).kind, 'dispute_won',
    'an inquiry that closes without a chargeback gives the credits back');
  await assert.rejects(send('checkout.session.completed', session, 'whsec_forged'), PaymentSignatureError);
  await assert.rejects(provider.webhook('{}', new Headers()), PaymentSignatureError);
});

test('the API in test mode: wallet, a pretend checkout through the signed webhook path, and drawings', async () => {
  const env = { CREDITS_MODE: 'test', AI_RATE_LIMITER: { async limit() { return { success: true }; } } };
  const api = async (path: string, init: RequestInit = {}) => (await handleApi(new Request('http://localhost:5173' + path, init), env, { allowTest: true }))!;
  const before = await (await api('/api/credits')).json() as { balance: number; packs: unknown[] };
  assert.equal(before.packs.length, CREDIT_PACKS.length);
  const post = (path: string, body: object) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const started = await (await post('/api/credits/checkout', { pack: 'starter', returnTo: '/editor.html' })).json() as { url: string; orderId: string };
  const page = new URL(started.url);
  assert.equal(page.pathname, '/api/payments/test/checkout');
  assert.match(await (await api(page.pathname + page.search)).text(), /Test checkout/);
  const form = new URLSearchParams({ order: started.orderId, success: page.searchParams.get('success')!, cancel: page.searchParams.get('cancel')!, outcome: 'paid' });
  const paid = await api('/api/payments/test/complete', { method: 'POST', body: form });
  assert.equal(paid.status, 303);
  assert.equal(paid.headers.get('location'), `http://localhost:5173/editor.html?checkout=success&order=${started.orderId}`);
  const confirmed = await (await api('/api/credits/orders/' + started.orderId)).json() as { status: string; balance: number };
  assert.deepEqual([confirmed.status, confirmed.balance - before.balance], ['paid', STARTER]);
  assert.equal((await post('/api/payments/test/webhook', { id: 'evt_forged' })).status, 400, 'an unsigned notification credits nothing');
  assert.equal((await post('/api/credits/checkout', { pack: 'starter', returnTo: '//evil.example/' })).status, 200, 'the return path falls back to the editor');
  assert.equal((await api('/api/credits', { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await handleApi(new Request('http://x.test/api/credits'), { ...env, CREDITS_MODE: 'test' }))!.status, 503,
    'a deployed Worker never runs test mode');
  assert.equal((await handleApi(new Request('http://x.test/api/credits'), { AI_RATE_LIMITER: env.AI_RATE_LIMITER }))!.status, 503,
    'without a ledger, credits are unavailable rather than free');
});

test('a refused Stripe request becomes a clear 502 with a secret-free reference, not a silent failure', async () => {
  const rejected = new Stripe.errors.StripeAuthenticationError({ type: 'authentication_error', code: 'api_key_invalid', message: 'Invalid API Key provided: sk_test_***secret' });
  const sent: Record<string, unknown>[] = [];
  const stripe = { checkout: { sessions: { create: async (params: Record<string, unknown>) => { sent.push(params); throw rejected; } } } } as unknown as Stripe;
  const provider = createStripeProvider('sk_test_unused', 'whsec_unused', stripe);
  const order = { id: 'o1', userId: buyer.id, packId: 'starter', credits: 50, amount: 499, currency: 'usd', provider: 'stripe', providerRef: null, status: 'pending' as const, createdAt: '' };
  await assert.rejects(provider.checkout(order, links, null, 'Starter'), (e: PaymentProviderError) => e instanceof PaymentProviderError && e.reason === 'authentication_error:api_key_invalid');

  assert.deepEqual(sent[0]!.managed_payments, { enabled: false }, 'Managed Payments needs a tax code on every product, so it stays off unless asked for');
  const store = createMemoryCreditStore();
  const service = createCreditService({ store, providers: [{ ...provider, id: 'stripe' }], requireAccount: false });
  const runtime: CreditRuntime = { mode: 'live', service, authenticate: async () => buyer, test: null };
  const response = (await handleCredits(new Request('https://app.test/api/credits/checkout', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pack: 'starter', returnTo: '/editor.html' }) }), runtime))!;
  const body = await response.json() as { error: { code: string; reason: string; message: string } };
  assert.equal(response.status, 502);
  assert.deepEqual([body.error.code, body.error.reason], ['CHECKOUT_FAILED', 'authentication_error:api_key_invalid']);
  assert.ok(!JSON.stringify(body).includes('sk_test'), 'the provider message and key never reach the browser');
  assert.ok(response.headers.get('x-request-id'));
});

test('a checkout that fails at the provider is closed, so failures never use up the hourly allowance', async () => {
  const store = createMemoryCreditStore(), expired: string[] = [];
  const failing: PaymentProvider = { id: 'fake', async checkout() { throw new PaymentProviderError('invalid_request_error:http_400'); },
    async lookup() { return null; }, async webhook() { throw new PaymentSignatureError(); } };
  const service = createCreditService({ store: { ...store, expireOrder: async id => { expired.push(id); await store.expireOrder(id); } }, providers: [failing], requireAccount: false });
  await assert.rejects(service.checkout(buyer, { pack: 'starter', provider: 'fake', links }), PaymentProviderError);
  assert.equal(expired.length, 1);
  assert.equal((await store.order(expired[0]!))!.status, 'expired');
});

test('a refund takes back the share of what was charged, so tax added at checkout does not take extra credits', async () => {
  const { service, fake, paid, headers } = setup();
  const { orderId } = await service.checkout(buyer, { pack: 'popular', provider: 'fake', links });
  fake.push(paid(orderId, 'evt_paid'));
  await service.receive('fake', 'signed', headers);
  // $9.99 plus $2.00 tax was charged; half of the $11.99 comes back: half the credits go, not 60% of them.
  fake.push({ kind: 'refunded', eventId: 'evt_half', paymentRef: 'pi_' + orderId, refundedAmount: 600, chargedAmount: 1199 });
  await service.receive('fake', 'signed', headers);
  assert.equal((await service.wallet(buyer)).balance, Math.floor(POPULAR * (1199 - 600) / 1199));
  fake.push({ kind: 'refunded', eventId: 'evt_rest', paymentRef: 'pi_' + orderId, refundedAmount: 1199, chargedAmount: 1199 });
  await service.receive('fake', 'signed', headers);
  assert.equal((await service.wallet(buyer)).balance, 0);
});

test('provider events that are not ours are skipped, and money taken without credits is reported', async () => {
  const store = createMemoryCreditStore(), fake = fakeProvider(), reports: string[] = [];
  // Postgres refuses a uuid query for a reference that is not one; the provider would then retry the event for days.
  const strict = { ...store, order: async (id: string) => { if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('invalid input syntax for type uuid'); return store.order(id); } };
  const service = createCreditService({ store: strict, providers: [fake.provider], requireAccount: true, report: event => reports.push(event) });
  fake.push({ kind: 'paid', eventId: 'evt_other_app', capture: { orderId: 'invoice-77', provider: 'fake', providerRef: 'cs_x', paymentRef: 'pi_x',
    amount: 500, currency: 'usd', email: null } });
  assert.equal(await service.receive('fake', 'signed', new Headers()), 'applied');
  assert.deepEqual(reports, []);
  const { orderId } = await service.checkout(buyer, { pack: 'starter', provider: 'fake', links });
  fake.push({ kind: 'paid', eventId: 'evt_short', capture: { orderId, provider: 'fake', providerRef: 'cs_' + orderId, paymentRef: 'pi_' + orderId,
    amount: 1, currency: 'usd', email: null } });
  await service.receive('fake', 'signed', new Headers());
  assert.deepEqual(reports, ['credits_paid_not_credited'], 'a paid order that was rejected is not silent');
});

test('confirming a purchase while the provider is down says it is still pending instead of failing', async () => {
  const store = createMemoryCreditStore(), reports: string[] = [];
  const down: PaymentProvider = { id: 'fake', async checkout(order) { return { url: 'https://pay.test/' + order.id, providerRef: 'cs_' + order.id }; },
    async lookup() { throw new PaymentProviderError('api_connection_error:unknown'); }, async webhook() { throw new PaymentSignatureError(); } };
  const service = createCreditService({ store, providers: [down], requireAccount: true, report: event => reports.push(event) });
  const { orderId } = await service.checkout(buyer, { pack: 'starter', provider: 'fake', links });
  assert.equal((await service.confirm(buyer, orderId)).status, 'pending');
  assert.deepEqual(reports, ['credits_lookup_failed']);
});

test('the schedule credits a paid checkout whose webhook never came, even if the person never returns', async () => {
  let clock = Date.parse('2026-10-25T10:00:00Z');
  const store = createMemoryCreditStore(() => clock), fake = fakeProvider();
  const service = createCreditService({ store, providers: [fake.provider], requireAccount: true });
  const { orderId } = await service.checkout(buyer, { pack: 'starter', provider: 'fake', links });
  fake.setLookup({ kind: 'paid', eventId: 'lookup_late', capture: { orderId, provider: 'fake', providerRef: 'cs_' + orderId, paymentRef: 'pi_' + orderId,
    amount: 499, currency: 'usd', email: null } });
  assert.equal(await service.reconcile(), 0, 'a checkout younger than ten minutes may still be on its payment page');
  clock += 11 * 60_000;
  assert.equal(await service.reconcile(), 1);
  assert.equal((await service.wallet(buyer)).balance, STARTER);
  assert.equal(await service.reconcile(), 0, 'a credited order is not looked up again');
});

test('a guest designs freely, but buying and using credits (a free drawing set too) needs an account', async () => {
  const { service } = setup();
  await assert.rejects(service.spend(guest, { feature: 'technical-drawings', key: 'drawings-guest-1', scope: 'design-1' }),
    (e: CreditError) => e.code === 'ACCOUNT_REQUIRED');
  await assert.rejects(service.reserve(guest, 'ai-image', 'image-guest-0001'), (e: CreditError) => e.code === 'ACCOUNT_REQUIRED');
  await assert.rejects(service.checkout(guest, { pack: 'starter', provider: 'fake', links }), (e: CreditError) => e.code === 'ACCOUNT_REQUIRED');
  assert.equal((await service.wallet(guest)).account.anonymous, true, 'a guest still sees the wallet and the packs');
  assert.equal((await service.spend(buyer, { feature: 'technical-drawings', key: 'drawings-buyer-1', scope: 'design-1' })).charge, 'free');
  const open = setup(false);
  assert.equal((await open.service.spend(guest, { feature: 'technical-drawings', key: 'drawings-guest-2', scope: 'design-1' })).charge, 'free',
    'CREDITS_REQUIRE_ACCOUNT=false lets guests use credits, as before');
});

test('the image cost comes from Google token prices: input, thinking and answer text, the 2K image and failed attempts', () => {
  // Typical: (4 × 1,120 + 1,700) input × $1.50, (3,000 + 200) text × $7.50, 1,680 image × $30, per million, plus 10%.
  assert.equal(Math.round(imageGenerationCost(IMAGE_REQUEST_TOKENS.typical) * 10000), 920);
  assert.equal(Math.round(imageGenerationCost(IMAGE_REQUEST_TOKENS.worst) * 10000), 1862);
  // $9.99 with 23% VAT inside and Stripe's 3% + $0.30: $7.52 is left.
  assert.equal(packRevenue(creditPack('popular')!).toFixed(2), '7.52');
});
