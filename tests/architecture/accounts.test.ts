import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountError, mergeGuest, type AccountStore, type Identity } from '../../src/application/account/account-merge';
import { handleAccount, type AccountRuntime } from '../../src/infrastructure/account/account-http';
import { handleApi } from '../../src/app/api-router';
import { adoptGuest, declineGuest, handOver, rememberGuest } from '../../src/infrastructure/account/guest-handover';
import { hasDesignWork } from '../../src/application/account/guest-work';
import { offerCopy } from '../../src/presentation/account/account-sheet';
import { adoptDrafts, createBrowserDrafts, forgetDrafts } from '../../src/infrastructure/persistence/browser-drafts';
import { connectSessions } from '../../src/app/session-platform';
import { MemoryProjectRepository } from '../../src/infrastructure/persistence/memory/memory-project-repository';
import { createProject } from '../../src/domain/project/project';
import { createEditorModel } from '../../src/application/projects/editor-model';

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


/** What the editor saved for a visitor who only opened it (read from the live editor): no wardrobe, the starting wall. */
const FRESH = JSON.parse('{"id":"ecef5682-eab4-41a3-8a63-3c7edd28a2fe","name":"Untitled design","units":"cm","studio":{"walls":[{"a":"c1","b":"c2","id":"w1","height":260,"thickness":12}],"corners":[{"x":-150,"z":0,"id":"c1"},{"x":150,"z":0,"id":"c2"}],"openings":[],"template":"custom"},"wardrobes":[],"schemaVersion":1}');

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

test('after signing in, a guest with real work is offered to the person, and nothing moves until they agree', async () => {
  const project = { url: 'https://project.test', key: 'sb_publishable_test' };
  const storage = memoryStorage(), calls: { url: string; auth: string | null; body: string }[] = [];
  let guestDesigns: unknown[] = [], balance = 0, merge = 200;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input), headers = new Headers(init?.headers);
    calls.push({ url, auth: headers.get('authorization'), body: String(init?.body ?? '') });
    if (url.includes('/rest/v1/design_sessions')) return Response.json(guestDesigns);
    if (url.includes('/rest/v1/credit_accounts')) return Response.json(balance ? [{ balance }] : []);
    return Response.json(merge === 200 ? { designs: 2, credits: balance } : { error: { code: 'ACCOUNTS_UNAVAILABLE' } }, { status: merge });
  };
  const signedIn = fakeClient(sessionOf(account.id, false));
  const worked = { ...FRESH, id: 'worked', name: 'Bedroom wardrobe', studio: { ...FRESH.studio, walls: [{ ...FRESH.studio.walls[0], height: 240 }] } };
  const landing = { ...FRESH, id: 'landing-2' };
  const remember = async () => { await rememberGuest(fakeClient(sessionOf(guest.id, true)), storage); };

  assert.deepEqual(await handOver(signedIn, project, storage, fetcher), { status: 'none' }, 'nothing remembered');
  await remember();
  assert.deepEqual(await handOver(fakeClient(sessionOf(guest.id, true)), project, storage, fetcher), { status: 'none' }, 'still the same guest: signing in is not finished');

  // Only the default design the editor made on landing, no credits: forgotten, nothing asked.
  guestDesigns = [{ id: 'landing-2', name: 'Untitled design', document: landing }];
  storage.setItem(`wardrobe:draft:${guest.id}:landing-2`, 'draft');
  assert.deepEqual(await handOver(signedIn, project, storage, fetcher), { status: 'none' });
  assert.equal(storage.getItem('wardrobe:account:guest'), null, 'the empty guest is forgotten');
  assert.equal(storage.getItem(`wardrobe:draft:${guest.id}:landing-2`), null, 'with the default design this browser kept for it');
  assert.ok(!calls.some(c => c.url.includes('/api/account/merge')), 'asking nothing moves nothing');

  // A design someone worked on: offered, still nothing moved.
  await remember();
  guestDesigns = [{ id: 'worked', name: 'Bedroom wardrobe', document: worked }, { id: 'landing-2', name: 'Untitled design', document: landing }];
  storage.setItem(`wardrobe:draft:${guest.id}:worked`, 'worked draft');
  assert.deepEqual(await handOver(signedIn, project, storage, fetcher), { status: 'offer', designs: [{ id: 'worked', name: 'Bedroom wardrobe' }], credits: 0 });
  assert.ok(calls.filter(c => c.url.includes('/rest/v1/')).every(c => c.auth === `Bearer token-${guest.id}`), 'read as the guest, never as the account');
  assert.ok(!calls.some(c => c.url.includes('/api/account/merge')), 'offered, not moved');
  assert.equal(storage.getItem(`wardrobe:draft:${account.id}:worked`), null);
  assert.notEqual(storage.getItem('wardrobe:account:guest'), null, 'the guest waits for the answer');

  // Credits alone are worth asking about too.
  guestDesigns = []; balance = 12;
  assert.deepEqual(await handOver(signedIn, project, storage, fetcher), { status: 'offer', designs: [], credits: 12 });

  // The person says yes: a failure keeps the offer, success moves the designs and the browser drafts.
  guestDesigns = [{ id: 'worked', name: 'Bedroom wardrobe', document: worked }]; balance = 0; merge = 503;
  await assert.rejects(adoptGuest(signedIn, project, storage, fetcher));
  assert.equal(storage.getItem(`wardrobe:draft:${account.id}:worked`), null, 'a failed move changes nothing');
  assert.notEqual(storage.getItem('wardrobe:account:guest'), null);
  merge = 200;
  assert.deepEqual(await adoptGuest(signedIn, project, storage, fetcher), { designs: 2, credits: 0 });
  assert.equal(JSON.parse(calls.at(-1)!.body).guest, `token-${guest.id}`);
  assert.equal(calls.at(-1)!.auth, `Bearer token-${account.id}`);
  assert.equal(storage.getItem(`wardrobe:draft:${account.id}:worked`), 'worked draft');
  assert.equal(storage.getItem('wardrobe:account:guest'), null);
  assert.deepEqual(await handOver(signedIn, project, storage, fetcher), { status: 'none' }, 'asked once');

  // The person says no: the guest's work stays out of the account and out of this browser.
  await remember();
  storage.setItem(`wardrobe:draft:${guest.id}:worked`, 'worked draft');
  declineGuest(storage);
  assert.equal(storage.getItem('wardrobe:account:guest'), null);
  assert.equal(storage.getItem(`wardrobe:draft:${guest.id}:worked`), null);
  assert.equal(storage.getItem(`wardrobe:draft:${account.id}:worked`), 'worked draft', 'what was already added stays');

  // An unreadable server answer is "ask later", a revoked guest is "lost", an account is never a guest.
  await remember();
  assert.deepEqual(await handOver(signedIn, project, storage, async () => new Response('x', { status: 500 })), { status: 'pending' });
  assert.notEqual(storage.getItem('wardrobe:account:guest'), null, 'kept for the next start');
  await rememberGuest(fakeClient(sessionOf(account.id, false)), storage);
  assert.equal(JSON.parse(storage.getItem('wardrobe:account:guest')!).id, guest.id, 'an account never replaces the remembered guest');
});

test('design work: a fresh landing is not work, anything the person did is', () => {
  assert.equal(hasDesignWork(FRESH), false, 'the starting wall the editor saves on landing');
  assert.equal(hasDesignWork({ ...FRESH, id: 'another', name: 'Renamed design' }), false, 'ids and the design name are not work');
  assert.equal(hasDesignWork(createProject('empty', 'Nothing')), false, 'no wardrobe, no room, no reach');
  assert.equal(hasDesignWork({ ...FRESH, maxReach: 185 }), true, 'a reach was set');
  const wall = FRESH.studio.walls[0];
  assert.equal(hasDesignWork({ ...FRESH, studio: { ...FRESH.studio, walls: [{ ...wall, height: 240 }] } }), true, 'a wall was adjusted');
  assert.equal(hasDesignWork({ ...FRESH, studio: { ...FRESH.studio, corners: [{ id: 'c1', x: -200, z: 0 }, FRESH.studio.corners[1]] } }), true, 'a corner was moved');
  assert.equal(hasDesignWork({ ...FRESH, studio: { ...FRESH.studio, walls: [wall, { ...wall, id: 'w2' }], corners: [...FRESH.studio.corners, { id: 'c3', x: 150, z: 300 }] } }), true, 'a wall was added');
  assert.equal(hasDesignWork({ ...FRESH, studio: { ...FRESH.studio, openings: [{ id: 'o1', wall: 'w1', kind: 'door' }] } }), true, 'a door was added');
  // A wardrobe, as the editor saves one with a hanging rail (read from the database).
  const wardrobe = JSON.parse(`{"dimensions":{"depth":60,"height":230,"width":200},"doors":"none","finish":"Oak","id":"d/cabinet/1","name":"Wardrobe 1","position":{"x":0,"y":0,"z":0},"rotation":0,"sections":[]}`);
  assert.equal(hasDesignWork({ ...createProject('w', 'W'), wardrobes: [wardrobe] }), true, 'a wardrobe was added');
  assert.equal(hasDesignWork({ ...FRESH, wardrobes: [wardrobe] }), true, 'a wardrobe in the starting room');
});

test('the offer says what was found and asks before moving it', () => {
  assert.match(offerCopy({ designs: [{ id: 'a', name: 'A' }], credits: 0 }, 'me@example.test'), /1 design from before you signed in\. Add it to me@example\.test\?/);
  assert.match(offerCopy({ designs: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], credits: 12 }, 'me@example.test'),
    /2 designs and 12 credits .* Add them to me@example\.test\? If you do not, they stay out of your account\./);
  assert.match(offerCopy({ designs: [], credits: 12 }, 'me@example.test'), /12 credits from before/);
});

test('the wallet reads every kind of ledger row the database can hold, a moved balance (transfer) included', async () => {
  const { createSupabaseCreditStore } = await import('../../src/infrastructure/credits/supabase-credit-store');
  const row = (id: number, kind: string, delta: number) => ({ id, delta, balance_after: 100, kind, feature: null, description: 'x', created_at: '2026-10-25T20:00:00Z' });
  const kinds = ['purchase', 'spend', 'refund', 'reversal', 'restore', 'grant', 'transfer'];
  const client = { rpc: async () => ({ data: { balance: 100, free_used: {}, passes: [], history: kinds.map((k, i) => row(i + 1, k, k === 'spend' ? -4 : 4)) }, error: null }) };
  const summary = await createSupabaseCreditStore(client as never).summary('a0000000-0000-4000-8000-000000000002', 30);
  assert.deepEqual(summary.history.map(h => h.kind), kinds);
});

test('signing out erases the account\'s designs from the browser and nothing else', () => {
  const storage = memoryStorage(), other = 'b0000000-0000-4000-8000-000000000009';
  const mine = createBrowserDrafts(storage, account.id);
  void mine.write({ document: createProject('d1', 'One'), expectedRevision: 3 });
  mine.preview('d1', 'image');
  mine.remove('d2');
  storage.setItem(`wardrobe:recovery:${account.id}:d1:before-fixture-rollback`, 'copy');
  void createBrowserDrafts(storage, guest.id).write({ document: createProject('g1', 'Guest'), expectedRevision: null });
  void createBrowserDrafts(storage, other).write({ document: createProject('o1', 'Other'), expectedRevision: 1 });
  storage.setItem('wardrobe:length-unit', 'mm');
  assert.equal(forgetDrafts(storage, account.id), 5, 'draft, preview, deletion marker, recovery copy and the open-design pointer');
  const left = [...Array(storage.length)].map((_, i) => storage.key(i)!);
  assert.equal(left.filter(k => k.includes(account.id)).length, 0);
  assert.ok(left.some(k => k.includes(guest.id)) && left.some(k => k.includes(other)) && left.includes('wardrobe:length-unit'), 'other scopes and preferences stay');
  assert.equal(mine.read(), null);
});

test('saving before sign-out says whether the design reached the account; a failed save must not be reported as saved', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: () => 0, addEventListener: () => undefined, removeEventListener: () => undefined } });
  const memory = new MemoryProjectRepository();
  let offline = false;
  const repository = { list: memory.list.bind(memory), load: memory.load.bind(memory), delete: memory.delete.bind(memory),
    save: (...args: Parameters<typeof memory.save>) => offline ? Promise.reject(new Error('network down')) : memory.save(...args) };
  const storage = memoryStorage(), model = createEditorModel();
  const editor = { snapshot: model.snapshot, scene: () => model.scene, notify: () => undefined };
  const connection = connectSessions({ repository, drafts: createBrowserDrafts(storage, account.id), client: null,
    draft: { document: createProject('d1', 'One'), expectedRevision: null }, saved: false } as never, editor as never);
  try {
    await connection.ready;
    assert.equal(await connection.save(), true, 'saved, nothing pending');
    offline = true;
    model.scene.wardrobes[0]!.name = 'edited while offline';
    assert.equal(await connection.save(), false, 'the edit could not reach the account: signing out must be refused');
    assert.equal((await memory.load('d1'))?.document.wardrobes[0]?.name === 'edited while offline', false);
    offline = false;
    assert.equal(await connection.save(), true, 'back online it is saved');
    assert.equal((await memory.load('d1'))?.document.wardrobes[0]?.name, 'edited while offline');
  } finally {
    connection.dispose();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});
