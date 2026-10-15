import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionAutosave } from '../../src/application/projects/session-autosave';
import { MemoryProjectRepository } from '../../src/infrastructure/persistence/memory/memory-project-repository';
import { createProject } from '../../src/domain/project/project';
import { ProjectConflictError } from '../../src/application/ports/project-repository';
import type { SessionDraft } from '../../src/application/projects/session-autosave';
import type { ProjectDocument } from '../../src/domain/project/project';
import type { ProjectRepository } from '../../src/application/ports/project-repository';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

test('autosaves serialize concurrent flushes and preserve edits made during a network write', async () => {
  const memory = new MemoryProjectRepository();
  const gate = deferred(); const entered = deferred();
  let requests = 0;
  let active = 0; let maxActive = 0;
  const repository: ProjectRepository = {
    list: () => memory.list(), load: id => memory.load(id), delete: (id, rev) => memory.delete(id, rev),
    async save(document, revision) {
      requests++; active++; maxActive = Math.max(maxActive, active);
      if (requests === 1) { entered.resolve(); await gate.promise; }
      try { return await memory.save(document, revision); } finally { active--; }
    },
  };
  let current = createProject('session', 'First');
  let draft: SessionDraft | undefined;
  const saver = createSessionAutosave({ document: current, expectedRevision: null }, {
    repository, capture: base => ({ ...base, name: current.name }),
    recover: async value => { draft = value; }, status: () => undefined,
  });
  const first = saver.flush(); await entered.promise;
  current = { ...current, name: 'Edited during save' };
  const second = saver.flush(); const third = saver.flush(); gate.resolve();
  await Promise.all([first, second, third]);
  assert.equal(maxActive, 1); assert.equal(requests, 2);
  assert.equal((await memory.load('session'))?.document.name, current.name);
  assert.equal(draft?.document.name, current.name); assert.equal(draft?.expectedRevision, 2);
  assert.equal(saver.revision, 2);
});

test('conflicts keep the local draft and stop writes without borrowing the remote revision', async () => {
  const memory = new MemoryProjectRepository();
  const document = createProject('session', 'Original');
  const initial = await memory.save(document, null);
  await memory.save({ ...document, name: 'Remote' }, 1);
  let draft: SessionDraft | undefined;
  let local = { ...document, name: 'Local' };
  const saver = createSessionAutosave({ document: initial.document, expectedRevision: 1 }, {
    repository: memory, capture: base => ({ ...base, name: local.name }),
    recover: async value => { draft = value; }, status: () => undefined,
  }, true);
  await assert.rejects(saver.flush(), ProjectConflictError);
  local = { ...local, name: 'Still editing after conflict' }; await saver.flush();
  assert.equal(saver.blocked, true); assert.equal(saver.revision, 1);
  assert.equal(draft?.document.name, local.name); assert.equal(draft?.expectedRevision, 1);
  assert.equal((await memory.load('session'))?.document.name, 'Remote');
});

test('a transient failure retries the current document and does not advance its expected revision', async () => {
  const memory = new MemoryProjectRepository(); let fail = true;
  const repository = {
    ...memory, list: () => memory.list(), load: (id: string) => memory.load(id),
    delete: (id: string, revision: number) => memory.delete(id, revision),
    save: async (document: ProjectDocument, revision: number | null) => {
      if (fail) { fail = false; throw new Error('Offline'); }
      return memory.save(document, revision);
    },
  };
  let current = createProject('session', 'Before failure');
  const saver = createSessionAutosave({ document: current, expectedRevision: null }, {
    repository, capture: base => ({ ...base, name: current.name }), recover: async () => undefined, status: () => undefined,
  });
  await assert.rejects(saver.flush(), /Offline/); assert.equal(saver.revision, null);
  current = { ...current, name: 'Edited offline' }; await saver.flush();
  assert.equal(saver.revision, 1); assert.equal((await memory.load('session'))?.document.name, 'Edited offline');
});

test('recovery failure prevents the cloud write and disposal prevents later saves', async () => {
  const repository = new MemoryProjectRepository();
  const document = createProject('session', 'Safe');
  const saver = createSessionAutosave({ document, expectedRevision: null }, {
    repository, capture: base => base, recover: async () => { throw new Error('Quota exceeded'); }, status: () => undefined,
  });
  await assert.rejects(saver.flush(), /Quota exceeded/);
  assert.equal(await repository.load('session'), null);
  await saver.dispose(); await saver.flush(); assert.equal(await repository.load('session'), null);
});

test('guest saves use browser recovery without a cloud repository', async () => {
  const document = createProject('guest', 'Guest design'); let draft: SessionDraft | undefined;
  const saver = createSessionAutosave({ document, expectedRevision: null }, {
    repository: null, capture: base => base, recover: async value => { draft = value; }, status: () => undefined,
  });
  await saver.flush(); assert.deepEqual(draft, { document, expectedRevision: null }); assert.equal(saver.revision, null);
});
