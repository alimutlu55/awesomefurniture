import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDesignCollection, DesignUnavailableError, type DesignDraftStore } from '../../src/application/projects/design-collection';
import type { ProjectRepository } from '../../src/application/ports/project-repository';
import type { SessionDraft } from '../../src/application/projects/session-autosave';
import { createProject } from '../../src/domain/project/project';

const draft = (id: string, revision: number | null): SessionDraft => ({ document: createProject(id, 'Design ' + id), expectedRevision: revision });
function store(drafts: SessionDraft[]): DesignDraftStore {
  return {
    list: () => drafts.map(d => ({ id: d.document.id, name: d.document.name, revision: d.expectedRevision ?? 0, updatedAt: '2026-10-25T10:00:00.000Z' })),
    read: id => drafts.find(d => d.document.id === id) ?? null,
    write: async () => {}, deleted: () => false, remove: () => {},
  };
}
const repository = (cloud: string[], failing = false): ProjectRepository => ({
  async list() { if (failing) throw new Error('offline'); return cloud.map(id => ({ id, name: 'Design ' + id, revision: 2, updatedAt: '2026-10-25T11:00:00.000Z' })); },
  async load(id: string) { return cloud.includes(id) ? { document: createProject(id, 'Design ' + id), revision: 2, updatedAt: '2026-10-25T11:00:00.000Z' } : null; },
  async save() { throw new Error('unused'); }, async delete() {}, async visibility() { throw new Error('unused'); },
} as unknown as ProjectRepository);

test('the library lists only designs that can be opened: a saved design removed from the cloud is not shown', async () => {
  const drafts = [draft('kept', 2), draft('removed-elsewhere', 5), draft('new-and-unsaved', null)];
  const collection = createDesignCollection(repository(['kept']), store(drafts), () => 'id');
  assert.deepEqual((await collection.list()).items.map(i => i.id).sort(), ['kept', 'new-and-unsaved']);
  await assert.rejects(collection.open('removed-elsewhere'), DesignUnavailableError, 'opening it was the failure; it is no longer offered');
});

test('when the cloud cannot be read, every browser draft is still listed', async () => {
  const drafts = [draft('saved-before', 5), draft('new-and-unsaved', null)];
  const collection = createDesignCollection(repository([], true), store(drafts), () => 'id');
  const { items, warning } = await collection.list();
  assert.deepEqual(items.map(i => i.id).sort(), ['new-and-unsaved', 'saved-before']);
  assert.match(warning ?? '', /could not be loaded/);
});
