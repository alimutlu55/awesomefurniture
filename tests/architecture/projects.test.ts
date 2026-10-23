import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createProject } from '../../src/domain/project/project';
import { renameProject } from '../../src/application/commands/rename-project';
import { ProjectHistory } from '../../src/application/history/project-history';
import { ProjectConflictError, type ProjectRepository } from '../../src/application/ports/project-repository';
import { createProjectService } from '../../src/application/projects/project-service';
import { MemoryProjectRepository } from '../../src/infrastructure/persistence/memory/memory-project-repository';
import { IndexedDbProjectRepository } from '../../src/infrastructure/persistence/indexeddb/indexeddb-project-repository';
import { deserializeProject, parseProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';

const now = () => '2026-10-06T12:00:00.000Z';
const factories: [string, () => ProjectRepository][] = [
  ['memory', () => new MemoryProjectRepository(now)],
  ['IndexedDB', () => new IndexedDbProjectRepository(new IDBFactory(), 'tests', now)],
];

for (const [adapter, createRepository] of factories) {
  test(`${adapter}: create, reopen, rename, list and delete a project`, async () => {
    const repository = createRepository();
    const projects = createProjectService(repository, () => 'project-1');
    const saved = await projects.create('  Bedroom  ');
    assert.equal(saved.document.name, 'Bedroom');
    assert.equal(saved.revision, 1);
    assert.deepEqual(await projects.open('project-1'), saved);
    const renamed = await projects.save(renameProject(saved.document, 'Guest room'), saved.revision);
    assert.equal(renamed.revision, 2);
    assert.deepEqual(await projects.list(), [{ id: 'project-1', name: 'Guest room', revision: 2, updatedAt: now() }]);
    await projects.delete('project-1', renamed.revision);
    assert.equal(await projects.open('project-1'), null);
  });

  test(`${adapter}: rejects stale saves, duplicate creates and stale deletes`, async () => {
    const repository = createRepository();
    const original = createProject('one', 'Original');
    await repository.save(original, null);
    await assert.rejects(repository.save(original, null), ProjectConflictError);
    await repository.save(renameProject(original, 'Newer'), 1);
    await assert.rejects(repository.save(renameProject(original, 'Stale'), 1), ProjectConflictError);
    await assert.rejects(repository.delete('one', 1), ProjectConflictError);
    assert.equal((await repository.load('one'))?.document.name, 'Newer');
  });

  test(`${adapter}: competing writers cannot both commit the same revision`, async () => {
    const repository = createRepository();
    const project = createProject('one', 'Original');
    await repository.save(project, null);
    const results = await Promise.allSettled([
      repository.save(renameProject(project, 'A'), 1),
      repository.save(renameProject(project, 'B'), 1),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const failed = results.find(result => result.status === 'rejected');
    assert.ok(failed?.status === 'rejected' && failed.reason instanceof ProjectConflictError);
    assert.equal((await repository.load('one'))?.revision, 2);
  });

  test(`${adapter}: returned records cannot mutate stored state`, async () => {
    const repository = createRepository();
    const saved = await repository.save(createProject('one', 'Original'), null);
    (saved.document as { name: string }).name = 'Changed outside storage';
    assert.equal((await repository.load('one'))?.document.name, 'Original');
  });

  test(`${adapter}: malformed writes preserve the existing record`, async () => {
    const repository = createRepository();
    const project = createProject('one', 'Original');
    await repository.save(project, null);
    await assert.rejects(repository.save({ ...project, name: '' }, 1));
    assert.equal((await repository.load('one'))?.revision, 1);
  });
}

test('IndexedDB: projects survive closing and reopening the adapter', async () => {
  const factory = new IDBFactory();
  const first = new IndexedDbProjectRepository(factory, 'reopen', now);
  const saved = await first.save(createProject('one', 'Bedroom'), null);
  await first.close();
  const second = new IndexedDbProjectRepository(factory, 'reopen', now);
  assert.deepEqual(await second.load('one'), saved);
  await second.close();
});

test('IndexedDB: separate connections enforce atomic revision checks', async () => {
  const factory = new IDBFactory();
  const first = new IndexedDbProjectRepository(factory, 'shared', now);
  const second = new IndexedDbProjectRepository(factory, 'shared', now);
  const project = createProject('one', 'Bedroom');
  await first.save(project, null);
  const results = await Promise.allSettled([
    first.save(renameProject(project, 'First tab'), 1),
    second.save(renameProject(project, 'Second tab'), 1),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await first.load('one'))?.revision, 2);
  await first.close();
  await second.close();
});

test('document codec round-trips data and rejects future versions and runtime fields', () => {
  const project = createProject('one', 'Bedroom');
  assert.deepEqual(deserializeProject(serializeProject(project)), project);
  assert.throws(() => parseProject({ ...project, schemaVersion: 3 }));
  assert.throws(() => parseProject({ ...project, selection: { itemId: 'transient' } }));
  assert.throws(() => deserializeProject('{invalid'));
});

test('history handles undo, redo, branching, limits and no-op commits', () => {
  const initial = createProject('one', 'Initial');
  const history = new ProjectHistory(initial, 2);
  history.commit(renameProject(initial, 'A'));
  history.commit(renameProject(initial, 'B'));
  history.commit(renameProject(initial, 'C'));
  assert.equal(history.undo().name, 'B');
  assert.equal(history.undo().name, 'A');
  assert.equal(history.canUndo, false);
  assert.equal(history.redo().name, 'B');
  history.commit(history.current);
  assert.equal(history.canRedo, true);
  history.commit(renameProject(history.current, 'Branch'));
  assert.equal(history.canRedo, false);
  assert.equal(history.undo().name, 'B');
  assert.throws(() => history.commit(createProject('other', 'Wrong project')));
});

test('project commands validate names and leave prior documents unchanged', () => {
  const original = createProject('one', 'Original');
  assert.equal(renameProject(original, ' Updated ').name, 'Updated');
  assert.equal(original.name, 'Original');
  assert.throws(() => renameProject(original, '   '));
  assert.throws(() => createProject('', 'Missing ID'));
});
