import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserDrafts } from '../../src/infrastructure/persistence/browser-drafts';
import { createProject } from '../../src/domain/project/project';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { sceneToProject } from '../../src/application/projects/editor-mapper';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { addCeiling } from '../../src/domain/studio/studio-ceiling';
import { parseProject } from '../../src/infrastructure/serialization/project-codec';

function storage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; }, clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

test('recovery drafts and active session pointers remain isolated between accounts and guests', async () => {
  const disk = storage();
  const owner = createBrowserDrafts(disk, 'owner'); const other = createBrowserDrafts(disk, 'other');
  const guest = createBrowserDrafts(disk, 'guest');
  const document = createProject('one', 'Private design');
  await owner.write({ document, expectedRevision: 7 });
  assert.deepEqual(owner.read(), { document, expectedRevision: 7 });
  assert.equal(other.read('one'), null); assert.equal(guest.read(), null);
  await owner.write({ document: createProject('two', 'Second design'), expectedRevision: null });
  assert.equal(owner.list().length, 2); assert.equal(owner.read()?.document.id, 'two');
  assert.equal(owner.read('one')?.expectedRevision, 7);
});

test('unreadable future-version drafts stay on disk rather than being reset', () => {
  const disk = storage(); const raw = JSON.stringify({ document: { ...createProject('future', 'Future'), schemaVersion: 99 }, expectedRevision: 1 });
  disk.setItem('wardrobe:draft:owner:future', raw); disk.setItem('wardrobe:active:owner', 'future');
  const drafts = createBrowserDrafts(disk, 'owner');
  assert.throws(() => drafts.read()); assert.deepEqual(drafts.list(), []);
  assert.equal(disk.getItem('wardrobe:draft:owner:future'), raw);
});

test('storage failures surface synchronously so leaving the page can warn instead of discarding a design', () => {
  const disk = storage(); disk.setItem = () => { throw new Error('Quota exceeded'); };
  const drafts = createBrowserDrafts(disk, 'owner');
  assert.throws(() => drafts.write({ document: createProject('one', 'Design'), expectedRevision: null }), /Quota/);
});

test('saving a scene after removing its room does not resurrect the previous room', () => {
  const scene = createEditorModel().scene;
  const previous = { ...createProject('session', 'Room removal'), studio: rectangleStudio(400, 400) };
  const document = sceneToProject(previous, scene);
  assert.equal(document.studio, undefined); assert.ok(document.wardrobes.length);
});

function rolledBackDraft() {
  const room = addCeiling(rectangleStudio(400, 400), 'w1', 'box')!;
  const ceiling = room.ceilings![0]!;
  const outline = [{ t: 100, y: 200 }, { t: 200, y: 200 }, { t: 200, y: 260 }];
  const document = { ...createProject('kitchen', 'Kitchen'), studio: {
    ...room, ceilings: [
      { ...ceiling, id: 'retired-1', outline, sections: [{ u: 0, outline }, { u: 1, outline }] },
      { ...ceiling, id: 'retired-2', outline },
      ceiling,
    ],
  } };
  return { document, expectedRevision: 362, savedAt: '2026-10-23T09:00:00.000Z' };
}

for (const entry of ['active', 'requested', 'library'] as const) {
  test(`${entry}: rolled-back ceiling drafts reopen without changing the rest of the design`, () => {
    const disk = storage(), value = rolledBackDraft(), raw = JSON.stringify(value);
    const key = 'wardrobe:draft:owner:kitchen';
    disk.setItem(key, raw); disk.setItem('wardrobe:active:owner', 'kitchen');
    assert.throws(() => parseProject(value.document), /Unrecognized key/);
    const drafts = createBrowserDrafts(disk, 'owner');
    if (entry === 'library') assert.equal(drafts.list()[0]?.name, 'Kitchen');
    const recovered = entry === 'active' ? drafts.read() : drafts.read('kitchen');
    const document = { ...value.document, studio: { ...value.document.studio, ceilings: [value.document.studio.ceilings[2]] } };
    assert.deepEqual(recovered, { document, expectedRevision: 362 });
    assert.deepEqual(JSON.parse(disk.getItem(key)!), { ...value, document });
    const backup = 'wardrobe:recovery:owner:kitchen:before-ceiling-rollback';
    assert.equal(disk.getItem(backup), raw);
    assert.equal(drafts.list().length, 1, 'the backup never appears as another design');
    assert.deepEqual(createBrowserDrafts(disk, 'owner').read(), recovered);
    assert.equal(disk.getItem(backup), raw, 'reopening keeps the original backup');
    assert.equal(createBrowserDrafts(disk, 'other').read('kitchen'), null);
  });
}

test('a draft with shaped ceilings (outlines) reopens with every shape kept', () => {
  const room = addCeiling(addCeiling(rectangleStudio(400, 400), 'w1', 'pillar')!, 'w2', 'stepped')!;
  const document = { ...createProject('shaped', 'Shaped'), studio: room };
  const disk = storage(), key = 'wardrobe:draft:owner:shaped';
  disk.setItem(key, JSON.stringify({ document, expectedRevision: 3 }));
  const read = createBrowserDrafts(disk, 'owner').read('shaped')!;
  assert.equal(read.document.studio?.ceilings?.length, 2);
  assert.ok(read.document.studio?.ceilings?.every(c => c.outline));
  assert.equal(disk.getItem('wardrobe:recovery:owner:shaped:before-ceiling-rollback'), null, 'nothing to recover');
});

test('ceiling recovery never hides other invalid fields or rewrites future formats', () => {
  for (const change of [{ schemaVersion: 99 }, { selection: {} }, { name: '' }]) {
    const disk = storage(), value = rolledBackDraft();
    const raw = JSON.stringify({ ...value, document: { ...value.document, ...change } });
    const key = 'wardrobe:draft:owner:kitchen'; disk.setItem(key, raw);
    const drafts = createBrowserDrafts(disk, 'owner');
    assert.throws(() => drafts.read('kitchen')); assert.deepEqual(drafts.list(), []);
    assert.equal(disk.getItem(key), raw); assert.equal(disk.length, 1);
  }
});

test('ceiling recovery retains the original if storing its backup fails', () => {
  const disk = storage(), raw = JSON.stringify(rolledBackDraft());
  const key = 'wardrobe:draft:owner:kitchen'; disk.setItem(key, raw);
  disk.setItem = () => { throw new Error('Quota exceeded'); };
  assert.throws(() => createBrowserDrafts(disk, 'owner').read('kitchen'), /Quota/);
  assert.equal(disk.getItem(key), raw);
});

test('version 2 ceiling-shape drafts reopen from browser storage after the database is repaired', () => {
  const disk = storage();
  const studio = addCeiling(rectangleStudio(400, 400), 'w1', 'box')!;
  const document = { ...createProject('recovered', 'Recovered design'), studio };
  const incompatible = { ...document, schemaVersion: 2, studio: { ...studio,
    ceilings: studio.ceilings!.map(ceiling => ({ ...ceiling, shape: { rings: [], loops: [], controls: [] } })),
  } };
  const raw = JSON.stringify({ document: incompatible, expectedRevision: 306 });
  const key = 'wardrobe:draft:owner:recovered';
  disk.setItem(key, raw); disk.setItem('wardrobe:active:owner', 'recovered');
  const drafts = createBrowserDrafts(disk, 'owner');
  assert.deepEqual(drafts.read(), { document, expectedRevision: 306 });
  assert.deepEqual(drafts.read('recovered'), { document, expectedRevision: 306 });
  assert.equal(disk.getItem('wardrobe:recovery:owner:recovered:before-ceiling-shape-rollback'), raw);
  assert.deepEqual(JSON.parse(disk.getItem(key)!).document, document);
});
