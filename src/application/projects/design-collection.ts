import type { ProjectRepository, ProjectSummary } from '../ports/project-repository';
import { ProjectConflictError } from '../ports/project-repository';
import type { SessionDraft } from './session-autosave';
import { createProject } from '../../domain/project/project';
import { renameProject } from '../commands/rename-project';
import { projectToScene, sceneToProject } from './editor-mapper';

export interface DesignDraftStore {
  list(): readonly ProjectSummary[];
  read(id?: string): SessionDraft | null;
  write(draft: SessionDraft, activate?: boolean): Promise<void>;
  deleted(id: string): boolean;
  remove(id: string): void;
}
export interface OpenDesign { draft: SessionDraft; saved: boolean }
export class DesignUnavailableError extends Error {
  constructor() { super('This design is private, deleted, or unavailable.'); }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Collection operations run only after the live editor has checkpointed and stopped. */
export function createDesignCollection(repository: ProjectRepository | null, drafts: DesignDraftStore, newId: () => string) {
  async function persist(draft: SessionDraft): Promise<OpenDesign> {
    await drafts.write(draft, false);
    if (!repository) return { draft, saved: false };
    let stored;
    try { stored = await repository.save(draft.document, draft.expectedRevision); }
    catch (error) {
      if (error instanceof ProjectConflictError) throw error;
      // A complete browser draft is sufficient for working offline.
      return { draft, saved: false };
    }
    const next = { document: stored.document, expectedRevision: stored.revision };
    await drafts.write(next, false);
    return { draft: next, saved: true };
  }
  async function list() {
    let cloud: readonly ProjectSummary[] = [], warning: string | null = null;
    if (repository) {
      try { cloud = await repository.list(); }
      catch { warning = 'Cloud designs could not be loaded. Your browser designs are available below.'; }
    }
    const merged = new Map(cloud.filter(row => !drafts.deleted(row.id)).map(row => [row.id, row]));
    for (const local of drafts.list()) {
      const remote = merged.get(local.id);
      if (!remote || local.revision >= remote.revision) merged.set(local.id, local);
    }
    return { items: [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)), warning };
  }
  async function open(id: string): Promise<OpenDesign> {
    if (drafts.deleted(id)) throw new DesignUnavailableError();
    const local = drafts.read(id);
    if (!repository) {
      if (!local) throw new DesignUnavailableError();
      return { draft: local, saved: false };
    }
    let stored;
    try { stored = await repository.load(id); }
    catch (error) {
      if (local) return { draft: local, saved: false };
      throw error;
    }
    if (drafts.deleted(id)) throw new DesignUnavailableError();
    if (!stored) {
      if (local?.expectedRevision === null) return { draft: local, saved: false };
      throw new DesignUnavailableError();
    }
    const remote = { document: stored.document, expectedRevision: stored.revision };
    if (local && local.expectedRevision !== stored.revision && !same(local.document, stored.document)) {
      // Preserve the local version; never apply its snapshot to the remote revision.
      const name = local.document.name.slice(0, 102) + ' · Recovered copy';
      await persist({ document: { ...local.document, id: newId(), name }, expectedRevision: null });
    }
    const draft = local?.expectedRevision === stored.revision ? local : remote;
    await drafts.write(draft, false);
    return { draft, saved: same(draft.document, stored.document) };
  }
  return {
    list, open,
    async create(name: string) {
      return persist({ document: createProject(newId(), name), expectedRevision: null });
    },
    async rename(id: string, name: string) {
      const { draft } = await open(id);
      return persist({ ...draft, document: renameProject(draft.document, name) });
    },
    async duplicate(id: string) {
      const { draft } = await open(id);
      const name = draft.document.name.slice(0, 113) + ' · Copy';
      const base = createProject(newId(), name);
      const scene = projectToScene(draft.document);
      const document = scene ? sceneToProject(base, scene) : base;
      return persist({ document, expectedRevision: null });
    },
    async remove(id: string, expectedRevision: number) {
      if (repository) {
        const stored = await repository.load(id);
        if (stored) {
          if (expectedRevision !== stored.revision) throw new ProjectConflictError();
          await repository.delete(id, stored.revision);
        }
      }
      drafts.remove(id);
    },
  };
}
export type DesignCollection = ReturnType<typeof createDesignCollection>;
