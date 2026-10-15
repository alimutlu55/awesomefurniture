import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserDrafts } from '../../src/infrastructure/persistence/browser-drafts';
import { createProject } from '../../src/domain/project/project';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { sceneToProject } from '../../src/application/projects/editor-mapper';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';

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
