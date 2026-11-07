import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANALYTICS_EVENTS, isServerEvent, realizingEvents, viewportClass, type AnalyticsEventName } from '../../src/domain/analytics/analytics-events';
import { cleanPath, cleanProperties, parseEnvelope } from '../../src/domain/analytics/analytics-validation';
import { createAnalyticsClient } from '../../src/infrastructure/analytics/analytics-client';
import { handleAnalytics } from '../../src/infrastructure/analytics/analytics-http';
import { createServerAnalytics, type AnalyticsRuntime } from '../../src/infrastructure/analytics/analytics-store';
import type { StoredAnalyticsEvent } from '../../src/domain/analytics/analytics-events';
import { analyticsAllowed, entryOf, sessionStart } from '../../src/app/analytics-platform';
import { createAgentApi } from '../../src/app/agent-api';
import { createCreditService } from '../../src/application/credits/credit-service';
import { createMemoryCreditStore } from '../../src/infrastructure/credits/memory-credit-store';
import type { PaymentProvider, PaymentUpdate } from '../../src/application/credits/credit-ports';
import { withDesignAnalytics } from '../../src/presentation/editor/piece-analytics';
import { sceneSummary } from '../../src/application/analytics/scene-summary';
import { creditPack } from '../../src/domain/credits/credit-catalog';

/** Product analytics (docs/analytics.md): what is measured, that nothing personal is stored, and the pipeline end to end. */

const envelope = (overrides: Record<string, unknown> = {}) => ({
  eventId: '6f1e0c1e-3c9b-4d7b-9a43-0a6f1f1b0001', event: 'design_shared', occurredAt: new Date().toISOString(),
  anonymousId: 'a1b2c3d4-0000-4000-8000-000000000001', clientSessionId: 'tab00000-0000-4000-8000-000000000001', designId: 'design-1',
  context: { locale: 'de', viewport: 'phone', entrySource: 'marketing_page', referrerPath: '/de/wardrobe-designer/' },
  properties: { product_mix: 'wardrobe', piece_count: 2 }, ...overrides,
});
const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://furnidraw.test/api/analytics', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://furnidraw.test', ...headers }, body: JSON.stringify(body),
});
function memoryRuntime(user: { id: string; anonymous: boolean } | null = null) {
  const memory: StoredAnalyticsEvent[] = [];
  const runtime: AnalyticsRuntime = { memory, sink: { async insert(events) { memory.push(...events); } },
    authenticate: async () => user ? { ...user, email: user.anonymous ? null : 'someone@example.test' } : null };
  return { runtime, memory };
}

test('the North Star view counts exactly the events marked as realizing a design', () => {
  const sql = readFileSync('supabase/migrations/20261108120000_analytics.sql', 'utf8');
  const view = sql.slice(sql.indexOf('create view analytics.weekly_realized_designs'), sql.indexOf('create view analytics.daily_events'));
  const named = new Set([...view.matchAll(/event (?:in \(([^)]*)\)|= '([a-z_]+)')/g)].flatMap(m => m[1] ? [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]!) : [m[2]!]));
  assert.deepEqual([...named].sort(), realizingEvents().sort());
  // Drawings count only when they pass the manufacturing check.
  assert.match(view, /event = 'drawings_opened' and properties->>'ready_for_manufacture' = 'true'/);
});

test('the event table and views are not reachable from a browser', () => {
  const sql = readFileSync('supabase/migrations/20261108120000_analytics.sql', 'utf8');
  assert.match(sql, /alter table public\.analytics_events enable row level security/);
  assert.match(sql, /revoke all on public\.analytics_events from public, anon, authenticated/);
  assert.match(sql, /revoke all on schema analytics from public, anon, authenticated/);
  assert.doesNotMatch(sql, /create policy/);
  assert.doesNotMatch(sql, /grant [^;]* to (?:anon|authenticated)/);
});

test('every event has a pillar, and money is only ever reported by the server', () => {
  for (const [name, definition] of Object.entries(ANALYTICS_EVENTS)) {
    assert.match(name, /^[a-z][a-z0-9_]{2,63}$/, name);
    assert.ok(definition.pillar, name);
  }
  assert.ok(isServerEvent('payment_settled') && isServerEvent('checkout_started'));
  assert.equal(parseEnvelope(envelope({ event: 'payment_settled', properties: { credits: 9999 } })), null, 'a browser cannot claim a payment');
});

test('properties keep only summary values: nothing personal, no design, no long text', () => {
  const clean = cleanProperties({
    piece_count: 3, ready: true, style: 'studio', rules: ['shelf-span', 'a@b.c'], nested: { document: {} },
    email: 'x@y.z', user_email: 'x', password: 'p', otp: '123456', access_token: 't', name: 'Ann', design_name: 'Our flat', ip: '1.2.3.4',
    note: 'someone@example.com', link: 'https://example.com/?token=1', long: 'x'.repeat(500), NotSnake: 1, infinite: Infinity,
    input_tokens: 1200,
  });
  assert.deepEqual(Object.keys(clean).sort(), ['input_tokens', 'long', 'piece_count', 'ready', 'rules', 'style']);
  assert.deepEqual(clean.rules, ['shelf-span']);
  assert.equal((clean.long as string).length, 120);
  assert.equal(cleanPath('/de/wardrobe-designer/?utm_source=x#top'), '/de/wardrobe-designer/');
  assert.equal(cleanPath('//evil.test/'), null);
  assert.equal(cleanPath('https://evil.test/'), null);
});

test('a browser event is checked: unknown names, bad ids and odd context are dropped or defaulted', () => {
  assert.equal(parseEnvelope(envelope({ event: 'made_up' })), null);
  assert.equal(parseEnvelope(envelope({ anonymousId: 'short' })), null);
  const odd = parseEnvelope(envelope({ occurredAt: '1999-01-01T00:00:00Z', context: { locale: '<script>', viewport: 'tv', entrySource: 'x', referrerPath: 'nope' } }), Date.now())!;
  assert.deepEqual(odd.context, { locale: 'en', viewport: 'desktop', entrySource: 'direct', referrerPath: null });
  assert.ok(Math.abs(Date.parse(odd.occurredAt) - Date.now()) < 5000, 'a clock far off is replaced by the time received');
  assert.equal(viewportClass(375), 'phone'); assert.equal(viewportClass(768), 'tablet'); assert.equal(viewportClass(1440), 'desktop');
});

test('POST /api/analytics stores events with the verified person and the country, never what the browser claims', async () => {
  const { runtime, memory } = memoryRuntime({ id: 'u0000000-0000-4000-8000-000000000001', anonymous: false });
  const forged = { ...envelope(), userId: 'someone-else', isAnonymous: false, country: 'US' };
  const response = await handleAnalytics(post({ events: [forged, envelope({ event: 'made_up' })] }, { 'cf-ipcountry': 'PL' }), runtime);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: 1 });
  assert.equal(memory.length, 1);
  const [stored] = memory;
  assert.equal(stored!.userId, 'u0000000-0000-4000-8000-000000000001');
  assert.equal(stored!.isAnonymous, false);
  assert.equal(stored!.country, 'PL');
  assert.equal(stored!.currency, 'pln');
  assert.equal(stored!.source, 'browser');
  assert.equal(stored!.context.referrerPath, '/de/wardrobe-designer/');
});

test('POST /api/analytics refuses other sites, other methods and oversized batches, and drops quietly when off', async () => {
  const { runtime } = memoryRuntime();
  assert.equal((await handleAnalytics(post({ events: [] }, { Origin: 'https://evil.test' }), runtime)).status, 403);
  assert.equal((await handleAnalytics(new Request('https://furnidraw.test/api/analytics'), runtime)).status, 405);
  assert.equal((await handleAnalytics(post({ events: Array.from({ length: 26 }, () => envelope()) }), runtime)).status, 400);
  assert.equal((await handleAnalytics(post({ events: [envelope({ properties: { note: 'x'.repeat(40_000) } })] }), runtime)).status, 413);
  const off = await handleAnalytics(post({ events: [envelope()] }), null);
  assert.equal(off.status, 202, 'without a store the batch is accepted and dropped, so browsers never retry');
  const failing: AnalyticsRuntime = { ...runtime, sink: { insert: async () => { throw new Error('down'); } } };
  const quiet = console.error; console.error = () => {};
  try { assert.equal((await handleAnalytics(post({ events: [envelope()] }), failing)).status, 503); } finally { console.error = quiet; }
});

test('the browser client batches, sends with the access token, and never throws', async () => {
  const sent: { body: { events: { event: string; designId: string | null; properties: Record<string, unknown> }[] }; init: RequestInit }[] = [];
  const store = new Map<string, string>(), storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  const client = createAnalyticsClient({
    enabled: true, intervalMs: 60_000, accessToken: async () => 'token-1', local: storage, session: storage,
    fetch: async (_url, init) => { sent.push({ body: JSON.parse(String(init!.body)), init: init! }); return new Response(null, { status: 202 }); },
    context: () => ({ locale: 'en', viewport: 'desktop' }), entry: { source: 'direct', referrerPath: null },
  });
  // The token is read ahead, so a request sent while the page closes (no time to wait) still carries it.
  await new Promise(resolve => setTimeout(resolve, 0));
  client.setDesign('design-7');
  client.track('design_shared', { product_mix: 'kitchen', piece_count: 4, email: 'leak@example.test' } as never);
  client.flush();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.init.keepalive, true);
  assert.equal(sent[0]!.body.events[0]!.designId, 'design-7');
  assert.deepEqual(sent[0]!.body.events[0]!.properties, { product_mix: 'kitchen', piece_count: 4 });
  assert.equal((sent[0]!.init.headers as Record<string, string>).Authorization, 'Bearer token-1');
  // The same browser keeps its id across clients (page loads).
  assert.ok(store.get('furnidraw.analytics.id'));
  client.dispose();

  const failing = createAnalyticsClient({ enabled: true, intervalMs: 60_000, accessToken: async () => null, local: null, session: null,
    fetch: async () => { throw new Error('offline'); }, context: () => { throw new Error('no window'); }, entry: { source: 'direct', referrerPath: null } });
  assert.doesNotThrow(() => { failing.track('design_shared', { product_mix: 'empty', piece_count: 0 }); failing.flush(); failing.dispose(); });

  let calls = 0;
  const off = createAnalyticsClient({ enabled: false, accessToken: async () => null, local: null, session: null,
    fetch: async () => { calls++; return new Response(); }, context: () => ({ locale: 'en', viewport: 'desktop' }), entry: { source: 'direct', referrerPath: null } });
  off.track('design_shared', { product_mix: 'empty', piece_count: 0 }); off.flush(); off.dispose();
  assert.equal(calls, 0);
});

test('analytics stay off for automated browsers and for visitors who ask not to be tracked', () => {
  const url = new URL('https://furnidraw.test/editor/');
  assert.equal(analyticsAllowed(url, { webdriver: false }), true);
  assert.equal(analyticsAllowed(url, { webdriver: true }), false);
  assert.equal(analyticsAllowed(new URL('https://furnidraw.test/editor/?analytics=1'), { webdriver: true }), true);
  assert.equal(analyticsAllowed(url, { webdriver: false, doNotTrack: '1' }), false);
  assert.equal(analyticsAllowed(url, { webdriver: false, globalPrivacyControl: true }), false);
});

test('the entry is read from the address and the referrer, and only a path on this site is kept', () => {
  const editor = new URL('https://furnidraw.test/editor/');
  assert.deepEqual(entryOf(editor, 'https://furnidraw.test/pl/under-stairs-wardrobe/?utm_source=x'), { source: 'marketing_page', referrerPath: '/pl/under-stairs-wardrobe/' });
  assert.deepEqual(entryOf(editor, 'https://www.google.com/search?q=wardrobe'), { source: 'external', referrerPath: null });
  assert.deepEqual(entryOf(editor, ''), { source: 'direct', referrerPath: null });
  assert.equal(entryOf(new URL('https://furnidraw.test/editor/#spec=abc'), '').source, 'spec_link');
  assert.equal(entryOf(new URL('https://furnidraw.test/editor/?session=s1'), '').source, 'shared_session');
  const start = sessionStart(new URL('https://furnidraw.test/editor/?utm_source=newsletter&utm_campaign=autumn'),
    { client: null as never, draft: null as never, saved: false, deferCreation: true });
  assert.deepEqual(start, { entry_type: 'new', utm_source: 'newsletter', utm_medium: null, utm_campaign: 'autumn', cloud_available: false });
});

test('agent calls are counted once per kind and outcome, so a checking loop is one event', () => {
  const events: unknown[] = [];
  const api = createAgentApi(() => null, { href: 'https://furnidraw.test/editor/' }, (event, properties) => events.push({ event, properties }));
  api.help(); api.help(); api.check({}); api.check({});
  assert.deepEqual(events, [{ event: 'agent_api_invoked', properties: { method: 'help', ok: true } },
    { event: 'agent_api_invoked', properties: { method: 'check', ok: false } }]);
});

test('the server records checkouts and settled payments, with how each payment was confirmed', async () => {
  const recorded: { event: string; properties: Record<string, unknown>; userId: string | null }[] = [];
  const analytics = { record: (event: string, properties: object, actor: { userId: string | null }) =>
    recorded.push({ event, properties: properties as Record<string, unknown>, userId: actor.userId }) };
  let next: PaymentUpdate | null = null;
  const provider: PaymentProvider = { id: 'fake', async checkout(order) { return { url: 'https://pay.test/' + order.id, providerRef: 'cs_' + order.id }; },
    async lookup() { return next; }, async webhook() { return next!; } };
  const service = createCreditService({ store: createMemoryCreditStore(), providers: [provider], requireAccount: true, analytics });
  const buyer = { id: 'b0000000-0000-4000-8000-000000000009', anonymous: false, email: 'buyer@example.test' };
  const links = { success: 'https://app.test/?order={ORDER}', cancel: 'https://app.test/?order={ORDER}' };
  const { orderId } = await service.checkout(buyer, { pack: 'popular', provider: 'fake', links, currency: 'eur' });
  const amount = creditPack('popular')!.prices.eur;
  next = { kind: 'paid', eventId: 'evt_1', capture: { orderId, provider: 'fake', providerRef: 'cs_' + orderId, paymentRef: 'pi_1', amount, currency: 'eur', email: null } };
  await service.confirm(buyer, orderId);
  await service.receive('fake', 'signed', new Headers());
  assert.deepEqual(recorded.map(r => r.event), ['checkout_started', 'payment_settled'], 'a replayed webhook is not counted twice');
  assert.equal(recorded[1]!.properties.settled_via, 'return_poll');
  assert.equal(recorded[1]!.properties.amount_minor, amount);
  assert.equal(recorded[1]!.userId, buyer.id);
});

test('server events are a log line and a stored row, and writing them never fails the request', async () => {
  const lines: string[] = [], { runtime, memory } = memoryRuntime();
  const server = createServerAnalytics(runtime, line => lines.push(line));
  server.record('payment_settled', { pack_id: 'popular', credits: 120, amount_minor: 2900, currency: 'eur', settled_via: 'webhook' }, { userId: 'u1', country: 'DE' });
  await server.drain();
  assert.deepEqual(JSON.parse(lines[0]!), { event: 'payment_settled', pack_id: 'popular', credits: 120, amount_minor: 2900, currency: 'eur', settled_via: 'webhook' });
  assert.equal(memory[0]!.source, 'server');
  assert.equal(memory[0]!.currency, 'eur');
  const broken = createServerAnalytics({ ...runtime, sink: { insert: async () => { throw new Error('down'); } } }, () => {});
  const quiet = console.error; console.error = () => {};
  try { broken.record('checkout_started', { pack_id: 'p', credits: 1, amount_minor: 1, currency: 'usd', provider: 'x' }, { userId: null }); await broken.drain(); }
  finally { console.error = quiet; }
});

test('what people add is counted only when the command changed the design', () => {
  const events: { event: AnalyticsEventName; properties: unknown }[] = [];
  const pieces = [{ state: { product: 'kitchen' } }] as never[];
  const commands = { addCabinet: (copy?: boolean) => copy ? null : { state: { product: undefined } }, addKitchenUnit: () => pieces[0]!,
    applyShapeTemplate: () => true, addStudioOpening: () => 'opening-1', other: () => 42 };
  const counted = withDesignAnalytics(commands, (event, properties) => events.push({ event, properties }), () => pieces);
  counted.addCabinet(false); counted.addCabinet(true); counted.addKitchenUnit(); counted.applyShapeTemplate(); counted.addStudioOpening();
  assert.equal(counted.other(), 42);
  assert.deepEqual(events.map(e => e.event), ['furniture_piece_added', 'furniture_piece_added', 'wardrobe_shape_changed', 'studio_room_edited']);
  assert.deepEqual(events[0]!.properties, { product: 'wardrobe', preset_id: 'regular', placement: 'wall', total_pieces_in_scene: 1 });
  assert.equal((events[1]!.properties as { product: string }).product, 'kitchen');
  assert.deepEqual(sceneSummary({ wardrobes: [{ state: { product: 'kitchen' } }, { state: {} }] as never }),
    { wardrobes: 1, kitchens: 1, pieces: 2, mix: 'both', product: 'wardrobe' });
});
