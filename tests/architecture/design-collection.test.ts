import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDesignCollection, DesignUnavailableError } from '../../src/application/projects/design-collection';
import { createBrowserDrafts } from '../../src/infrastructure/persistence/browser-drafts';
import { MemoryProjectRepository } from '../../src/infrastructure/persistence/memory/memory-project-repository';
import { createProject } from '../../src/domain/project/project';
import { ProjectConflictError } from '../../src/application/ports/project-repository';

function setup() {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); }, clear: () => data.clear(),
  };
  const drafts = createBrowserDrafts(storage, 'owner');
  const repository = new MemoryProjectRepository();
  let counter = 0;
  const create = (remote = true) => createDesignCollection(remote ? repository : null, drafts, () => `new-${++counter}`);
  return { drafts, repository, create, storage };
}

test('collection creates, renames, duplicates and deletes without moving the active draft pointer', async () => {
  const { create, drafts, repository } = setup(), collection = create();
  const first = await collection.create('  Bedroom  '); drafts.activate(first.draft.document.id);
  const other = await collection.create('Hallway');
  await collection.rename(other.draft.document.id, 'Hallway final');
  const copy = await collection.duplicate(first.draft.document.id);
  assert.notEqual(copy.draft.document.id, first.draft.document.id);
  assert.equal(copy.draft.document.name, 'Bedroom · Copy');
  assert.equal(drafts.read()?.document.id, first.draft.document.id);
  const rows = (await collection.list()).items;
  assert.equal(rows.length, 3);
  const renamed = rows.find(row => row.id === other.draft.document.id)!;
  await collection.remove(renamed.id, renamed.revision);
  assert.equal(await repository.load(renamed.id), null);
  assert.equal(drafts.read(renamed.id), null);
  assert.ok(drafts.deleted(renamed.id));
  assert.equal((await collection.list()).items.length, 2);
  await assert.rejects(collection.open(renamed.id), DesignUnavailableError);
});

test('offline work remains editable and lists deduplicate a newer local name against its cloud revision', async () => {
  const { create, drafts, repository } = setup();
  const stored = await repository.save(createProject('one', 'Cloud name'), null);
  await drafts.write({ document: { ...stored.document, name: 'Edited offline' }, expectedRevision: 1 });
  const live = create(), offline = create(false);
  assert.equal((await live.list()).items.length, 1);
  assert.equal((await live.list()).items[0]?.name, 'Edited offline');
  assert.equal((await offline.open('one')).draft.document.name, 'Edited offline');
  assert.equal((await live.open('one')).saved, false);
  const renamed = await offline.rename('one', 'Offline final');
  assert.equal(renamed.saved, false);
  assert.equal((await repository.load('one'))?.document.name, 'Cloud name');
});

test('a newer remote revision keeps the local snapshot as a separate recovered copy', async () => {
  const { create, drafts, repository } = setup();
  const original = await repository.save(createProject('one', 'Original'), null);
  await drafts.write({ document: { ...original.document, name: 'Local change' }, expectedRevision: 1 });
  await repository.save({ ...original.document, name: 'Other tab change' }, 1);
  const collection = create();
  const opened = await collection.open('one');
  assert.equal(opened.draft.document.name, 'Other tab change');
  assert.equal(opened.draft.expectedRevision, 2);
  const rows = (await collection.list()).items;
  assert.equal(rows.length, 2);
  assert.ok(rows.some(row => row.name === 'Local change · Recovered copy'));
  await collection.open('one');
  assert.equal((await collection.list()).items.length, 2, 'reopening does not create another recovered copy');
});

test('deletion requires the revision shown in the list and retains local data on a conflict', async () => {
  const { create, drafts, repository } = setup(), collection = create();
  const first = await collection.create('Bedroom');
  await repository.save({ ...first.draft.document, name: 'New work in another tab' }, 1);
  await assert.rejects(collection.remove(first.draft.document.id, 1), ProjectConflictError);
  assert.ok(drafts.read(first.draft.document.id));
  assert.equal(drafts.deleted(first.draft.document.id), false);
});

test('a tombstone blocks writes from another tab and clears the active pointer and thumbnail', async () => {
  const { drafts, storage } = setup();
  const otherTab = createBrowserDrafts(storage, 'owner');
  const draft = { document: createProject('one', 'Bedroom'), expectedRevision: 1 };
  await drafts.write(draft); drafts.preview('one', 'data:image/jpeg;base64,example');
  drafts.remove('one');
  assert.equal(drafts.read(), null); assert.equal(otherTab.read('one'), null);
  assert.equal(otherTab.preview('one'), null);
  assert.throws(() => otherTab.write(draft), /deleted/);
  assert.deepEqual(otherTab.list(), []);
});

test('a failed cloud delete does not hide the design or remove its browser recovery', async () => {
  const { drafts, repository } = setup();
  const saved = await repository.save(createProject('one', 'Bedroom'), null);
  await drafts.write({ document: saved.document, expectedRevision: 1 });
  const collection = createDesignCollection({
    list: repository.list.bind(repository), load: repository.load.bind(repository), save: repository.save.bind(repository),
    async delete() { throw new Error('Offline'); },
  }, drafts, () => 'new');
  await assert.rejects(collection.remove('one', 1), /Offline/);
  assert.ok(drafts.read('one')); assert.equal(drafts.deleted('one'), false);
});
