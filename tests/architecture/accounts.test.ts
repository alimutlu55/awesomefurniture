import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountError, mergeGuest, type AccountStore, type Identity } from '../../src/application/account/account-merge';
import { handleAccount, type AccountRuntime } from '../../src/infrastructure/account/account-http';
import { handleApi } from '../../src/app/api-router';
import { handOver, rememberGuest } from '../../src/infrastructure/account/guest-handover';
import { adoptDrafts } from '../../src/infrastructure/persistence/browser-drafts';

const guest: Identity = { id: 'a0000000-0000-4000-8000-000000000001', anonymous: true, email: null };
const account: Identity = { id: 'a0000000-0000-4000-8000-000000000002', anonymous: false, email: 'person@example.test' };

function recordingStore() {
  const merges: [string, string][] = [];
  const store: AccountStore = { async merge(from, to) { merges.push([from, to]); return { designs: 3, credits: 12 }; } };
  return { store, merges };
}

test('a guest merges only into a permanent account, proven by both tokens', async () => {
  const { store, merges } = recordingStore();
  assert.deepEqual(await mergeGuest(store, account, guest), { designs: 3, credits: 12 });
  assert.deepEqual(merges, [[guest.id, account.id]]);
  await assert.rejects(mergeGuest(store, guest, guest), (e: AccountError) => e.code === 'SIGN_IN_REQUIRED', 'a guest is not an account');
  await assert.rejects(mergeGuest(store, null, guest), (e: AccountError) => e.code === 'SIGN_IN_REQUIRED');
  await assert.rejects(mergeGuest(store, account, account), (e: AccountError) => e.code === 'GUEST_REQUIRED', 'an account is never merged away');
  await assert.rejects(mergeGuest(store, account, null), (e: AccountError) => e.code === 'GUEST_REQUIRED');
  assert.equal(merges.length, 1);
});

test('the merge endpoint checks origin, both tokens and the request, and never shows internal errors', async () => {
  const { store, merges } = recordingStore();
  const tokens: Record<string, Identity> = { 'account-token': account, 'guest-token': guest };
  const runtime: AccountRuntime = { store, verify: async token => tokens[token] ?? null };
  const merge = (init: { token?: string; body?: unknown; origin?: string; type?: string; method?: string } = {}) =>
    handleAccount(new Request('https://app.test/api/account/merge', {
      method: init.method ?? 'POST',
      headers: { 'content-type': init.type ?? 'application/json', ...(init.token ? { authorization: 'Bearer ' + init.token } : {}),
        ...(init.origin ? { origin: init.origin } : {}) },
      ...(init.method === 'GET' ? {} : { body: JSON.stringify(init.body ?? { guest: 'guest-token' }) }),
    }), runtime);

  const ok = await merge({ token: 'account-token' });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { designs: 3, credits: 12 });
  assert.equal((await merge({ token: 'guest-token' })).status, 401, 'a guest cannot take another guest');
  assert.equal((await merge({ token: 'account-token', body: { guest: 'forged' } })).status, 401);
  assert.equal((await merge({ token: 'account-token', origin: 'https://evil.example' })).status, 403);
  assert.equal((await merge({ token: 'account-token', type: 'text/plain' })).status, 400);
  assert.equal((await merge({ token: 'account-token', method: 'GET' })).status, 405);
  assert.equal(merges.length, 1);

  const broken = await handleAccount(new Request('https://app.test/api/account/merge', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer account-token' }, body: JSON.stringify({ guest: 'guest-token' }) }),
  { ...runtime, store: { async merge() { throw new Error('connection refused to db.internal:5432'); } } });
  const body = await broken.json() as { error: { code: string; message: string; reason: string } };
  assert.equal(broken.status, 500);
  assert.equal(body.error.code, 'ACCOUNT_MERGE_FAILED');
  assert.ok(!JSON.stringify(body).includes('db.internal'), 'the database error never reaches the browser');
  assert.equal(body.error.reason, broken.headers.get('x-request-id'));
});

test('without the server secret, merging answers 503 so the browser keeps the guest and tries again', async () => {
  const response = (await handleApi(new Request('https://app.test/api/account/merge', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: '{}' }), { AI_RATE_LIMITER: { async limit() { return { success: true }; } } }))!;
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { error: { code: string } }).error.code, 'ACCOUNTS_UNAVAILABLE');
});

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null, getItem: k => values.get(k) ?? null,
    setItem: (k, v) => { values.set(k, String(v)); }, removeItem: k => { values.delete(k); }, clear: () => values.clear() };
}
const sessionOf = (id: string, anonymous: boolean) => ({ user: { id, is_anonymous: anonymous }, access_token: `token-${id}`,
  refresh_token: `refresh-${id}`, expires_at: Math.floor(Date.now() / 1000) + 3600 });
function fakeClient(session: ReturnType<typeof sessionOf> | null) {
  return { auth: { getSession: async () => ({ data: { session } }) } } as never;
}

test('the guest browser drafts move to the account; drafts the account already has are never replaced', () => {
  const storage = memoryStorage();
  storage.setItem(`wardrobe:draft:${guest.id}:d1`, 'guest d1');
  storage.setItem(`wardrobe:draft:${guest.id}:d2`, 'guest d2');
  storage.setItem(`wardrobe:preview:${guest.id}:d1`, 'image');
  storage.setItem(`wardrobe:active:${guest.id}`, 'd1');
  storage.setItem(`wardrobe:draft:${account.id}:d2`, 'account d2');
  adoptDrafts(storage, guest.id, account.id);
  assert.equal(storage.getItem(`wardrobe:draft:${account.id}:d1`), 'guest d1');
  assert.equal(storage.getItem(`wardrobe:draft:${account.id}:d2`), 'account d2');
  assert.equal(storage.getItem(`wardrobe:preview:${account.id}:d1`), 'image');
  assert.equal(storage.getItem(`wardrobe:active:${account.id}`), 'd1', 'the design that was open opens again');
  assert.equal([...Array(storage.length)].map((_, i) => storage.key(i)).filter(k => k?.includes(guest.id)).length, 0);
});

test('after signing in, the remembered guest is handed over once; a failure keeps it for the next start', async () => {
  const project = { url: 'https://project.test', key: 'sb_publishable_test' };
  const storage = memoryStorage(), calls: { auth: string | null; body: string }[] = [];
  const answer = (status: number, body: unknown): typeof fetch => async (_url, init) => {
    calls.push({ auth: new Headers(init?.headers).get('authorization'), body: String(init?.body) });
    return Response.json(body, { status });
  };
  assert.deepEqual(await handOver(fakeClient(sessionOf(account.id, false)), project, storage, answer(200, {})), { status: 'none' }, 'nothing remembered');
  await rememberGuest(fakeClient(sessionOf(guest.id, true)), storage);
  assert.deepEqual(await handOver(fakeClient(sessionOf(guest.id, true)), project, storage, answer(200, {})), { status: 'none' },
    'still the same guest: signing in is not finished');
  storage.setItem(`wardrobe:draft:${guest.id}:d1`, 'guest d1');
  assert.deepEqual(await handOver(fakeClient(sessionOf(account.id, false)), project, storage, answer(503, { error: { code: 'ACCOUNTS_UNAVAILABLE' } })),
    { status: 'pending' });
  assert.equal(storage.getItem(`wardrobe:draft:${guest.id}:d1`), 'guest d1', 'nothing moves until the server has moved the designs');
  assert.deepEqual(await handOver(fakeClient(sessionOf(account.id, false)), project, storage, answer(200, { designs: 2, credits: 0 })),
    { status: 'merged', designs: 2, credits: 0 });
  assert.equal(calls.at(-1)!.auth, `Bearer token-${account.id}`);
  assert.equal(JSON.parse(calls.at(-1)!.body).guest, `token-${guest.id}`);
  assert.equal(storage.getItem(`wardrobe:draft:${account.id}:d1`), 'guest d1');
  assert.deepEqual(await handOver(fakeClient(sessionOf(account.id, false)), project, storage, answer(200, { designs: 9, credits: 0 })), { status: 'none' },
    'handed over once');
  await rememberGuest(fakeClient(sessionOf(guest.id, true)), storage);
  assert.deepEqual(await handOver(fakeClient(sessionOf(account.id, false)), project, storage, answer(401, { error: { code: 'GUEST_REQUIRED' } })),
    { status: 'lost' });
  assert.deepEqual(await handOver(fakeClient(sessionOf(account.id, false)), project, storage, answer(200, {})), { status: 'none' }, 'a lost guest is forgotten');
  await rememberGuest(fakeClient(sessionOf(account.id, false)), storage);
  assert.equal(storage.getItem('wardrobe:account:guest'), null, 'an account is never remembered as a guest');
});

test('the wallet reads every kind of ledger row the database can hold, a moved balance (transfer) included', async () => {
  const { createSupabaseCreditStore } = await import('../../src/infrastructure/credits/supabase-credit-store');
  const row = (id: number, kind: string, delta: number) => ({ id, delta, balance_after: 100, kind, feature: null, description: 'x', created_at: '2026-10-25T20:00:00Z' });
  const kinds = ['purchase', 'spend', 'refund', 'reversal', 'restore', 'grant', 'transfer'];
  const client = { rpc: async () => ({ data: { balance: 100, free_used: {}, passes: [], history: kinds.map((k, i) => row(i + 1, k, k === 'spend' ? -4 : 4)) }, error: null }) };
  const summary = await createSupabaseCreditStore(client as never).summary('a0000000-0000-4000-8000-000000000002', 30);
  assert.deepEqual(summary.history.map(h => h.kind), kinds);
});
