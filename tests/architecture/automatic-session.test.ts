import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectSessions } from '../../src/app/session-platform';
import { MemoryProjectRepository } from '../../src/infrastructure/persistence/memory/memory-project-repository';
import { createBrowserDrafts } from '../../src/infrastructure/persistence/browser-drafts';
import { createProject } from '../../src/domain/project/project';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { bindShareMenu } from '../../src/presentation/editor/bindings/share.js';

test('landing stores a session immediately, existing Share includes its ID, and reload reuses it without adding UI', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    setInterval: () => 0, addEventListener: () => undefined, removeEventListener: () => undefined,
  } });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://wardrobe.test/') });
  const memory = new MemoryProjectRepository(); let published = '';
  const repository = {
    save: memory.save.bind(memory), load: memory.load.bind(memory), list: memory.list.bind(memory), delete: memory.delete.bind(memory),
    async visibility(id: string, revision: number, value: string) {
      published = value; const stored = await memory.load(id);
      return memory.save(stored!.document, revision);
    },
  };
  const data = new Map<string, string>();
  const disk: Storage = {
    get length() { return data.size; }, clear: () => data.clear(), key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); },
  };
  const drafts = createBrowserDrafts(disk, 'anonymous-owner');
  const model = createEditorModel();
  const editor = { snapshot: model.snapshot, scene: () => model.scene, notify: () => undefined };
  let connection: ReturnType<typeof connectSessions> | undefined;
  try {
    connection = connectSessions({ repository, drafts, client: null,
      draft: { document: createProject('landing-session', 'Wardrobe design'), expectedRevision: null }, saved: false } as never, editor as never);
    await connection.ready;
    assert.equal((await memory.list()).length, 1);
    assert.equal((await memory.load('landing-session'))?.document.wardrobes.length, 1);
    assert.equal(published, '', 'landing remains private');
    const link = new URL(await connection.share());
    assert.equal(link.searchParams.get('session'), 'landing-session'); assert.equal(link.hash, '');
    assert.equal(published, 'public');
    connection.dispose();
    connection = connectSessions({ repository, drafts, client: null, draft: drafts.read()!, saved: true } as never, editor as never);
    await connection.ready;
    assert.equal((await memory.list()).length, 1, 'reload must not create another design session');
    assert.equal((await memory.load('landing-session'))?.revision, 2);
  } finally {
    connection?.dispose();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation); else Reflect.deleteProperty(globalThis, 'location');
  }
});

test('the existing menu publishes only when Share is clicked, and copies the returned session link', async () => {
  const item = { hidden: true }; const menu = {};
  const listeners = new Map<unknown, () => Promise<void>>(); let copies = ''; let publications = 0;
  bindShareMenu({
    dom: { $: (id: string) => id === '#share-menu' ? item : menu,
      navigator: { clipboard: { writeText: async (url: string) => { copies = url; } } },
      history: {}, matchMedia: () => ({ matches: false }) },
    shell: { closeDD: () => undefined, toast: () => undefined }, model: { scene: createEditorModel().scene },
    lifetime: { listen: (target: unknown, _event: string, callback: () => Promise<void>) => { listeners.set(target, callback); } },
    shareLink: async () => { publications++; return 'https://wardrobe.test/?session=current-session'; },
  } as never);
  assert.equal(item.hidden, false); assert.equal(publications, 0); assert.equal(listeners.has(menu), false);
  await listeners.get(item)!();
  assert.equal(publications, 1); assert.equal(new URL(copies).searchParams.get('session'), 'current-session');
});

test('background save failures stay silent, retain the draft and retry on the next tick', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let tick = () => {}; let unavailable = true; let attempts = 0; let recovered = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    setInterval: (callback: () => void) => { tick = callback; return 0; },
    addEventListener: () => undefined, removeEventListener: () => undefined,
  } });
  const memory = new MemoryProjectRepository(), model = createEditorModel();
  const repository = { async save(document: Parameters<typeof memory.save>[0], revision: number | null) {
    attempts++;
    if (unavailable) throw new Error('Network unavailable');
    return memory.save(document, revision);
  } };
  let connection: ReturnType<typeof connectSessions> | undefined;
  try {
    connection = connectSessions({ repository, drafts: { write: async () => { recovered++; } },
      draft: { document: createProject('quiet-retry', 'Wardrobe design'), expectedRevision: null }, saved: false } as never,
    { snapshot: model.snapshot, scene: () => model.scene, notify: () => assert.fail('Background saving must not show a notification') } as never);
    await connection.ready;
    assert.equal(attempts, 1); assert.ok(recovered > 0, 'browser recovery precedes the failed request');
    unavailable = false; tick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(attempts, 2);
    assert.equal((await memory.load('quiet-retry'))?.revision, 1, 'the retry still saves the design');
  } finally {
    connection?.dispose();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('closing waits for an in-flight save and stops all captures before another editor can mount', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let tick = () => {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    setInterval: (callback: () => void) => { tick = callback; return 0; }, clearInterval: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
  } });
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const saving = new Promise<void>(resolve => { entered = resolve; });
  const memory = new MemoryProjectRepository(), model = createEditorModel();
  let writes = 0, captures = 0, closed = false;
  const recovered: unknown[] = [];
  const repository = {
    async save(document: Parameters<typeof memory.save>[0], revision: number | null) {
      writes++; if (writes === 1) { entered(); await gate; }
      return memory.save(document, revision);
    }, load: memory.load.bind(memory),
  };
  let connection: ReturnType<typeof connectSessions> | undefined;
  try {
    connection = connectSessions({ repository, drafts: { write: async (draft: unknown) => { recovered.push(draft); } },
      draft: { document: createProject('outgoing', 'Original'), expectedRevision: null }, saved: false } as never,
    { snapshot: () => { captures++; return model.snapshot(); }, scene: () => model.scene } as never);
    await saving;
    const closing = connection.close().then(result => { closed = true; return result; });
    await new Promise(resolve => setImmediate(resolve)); assert.equal(closed, false);
    release(); const result = await closing;
    assert.equal(result.draft.document.id, 'outgoing'); assert.equal(result.saved, true);
    const afterClose = captures;
    tick(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(captures, afterClose, 'a timer cannot capture the next editor after closing');
    assert.equal((await memory.load('outgoing'))?.document.wardrobes.length, 1);
    assert.ok(recovered.length); assert.equal(writes, 1);
  } finally {
    release(); await connection?.dispose();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('closing retains local recovery on a cloud failure, but refuses navigation when browser recovery fails', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    setInterval: () => 0, clearInterval: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  } });
  let quota = false; const recovered: unknown[] = [];
  let connection: ReturnType<typeof connectSessions> | undefined;
  try {
    const model = createEditorModel();
    const platform = { repository: { async save() { throw new Error('Cloud offline'); } },
      drafts: { write: async (draft: unknown) => { if (quota) throw new Error('Quota exceeded'); recovered.push(draft); } },
      draft: { document: createProject('local', 'Local design'), expectedRevision: null }, saved: false };
    connection = connectSessions(platform as never, { snapshot: model.snapshot, scene: () => model.scene } as never);
    await connection.ready; quota = true;
    await assert.rejects(connection.close(), /Quota exceeded/);
    quota = false; const result = await connection.close();
    assert.equal(result.saved, false); assert.equal(result.draft.document.id, 'local'); assert.ok(recovered.length);
  } finally {
    await connection?.dispose();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});
