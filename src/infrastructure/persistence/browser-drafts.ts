import type { SessionDraft } from '../../application/projects/session-autosave';
import type { ProjectSummary } from '../../application/ports/project-repository';
import { parseProject } from '../serialization/project-codec';

/** Scoped to the identity. Drafts survive navigation, failures and cloud conflicts. */
export function createBrowserDrafts(storage: Storage, scope: string) {
  const prefix = `wardrobe:draft:${scope}:`;
  const activeKey = `wardrobe:active:${scope}`;
  return {
    list(): readonly ProjectSummary[] {
      const records: ProjectSummary[] = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (!key?.startsWith(prefix)) continue;
        try {
          const value = JSON.parse(storage.getItem(key)!) as { document: unknown; expectedRevision: number | null; savedAt?: string };
          const document = parseProject(value.document);
          records.push({ id: document.id, name: document.name, revision: value.expectedRevision ?? 0, updatedAt: value.savedAt ?? '' });
        } catch { /* Preserve unreadable drafts for manual recovery; never erase them. */ }
      }
      return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    read(id = storage.getItem(activeKey)): SessionDraft | null {
      if (!id) return null;
      const raw = storage.getItem(prefix + id);
      if (!raw) return null;
      const value = JSON.parse(raw) as { document: unknown; expectedRevision: unknown };
      const revision = value.expectedRevision;
      if (revision !== null && (!Number.isInteger(revision) || Number(revision) < 1)) throw new Error('Invalid recovery revision.');
      return { document: parseProject(value.document), expectedRevision: revision as number | null };
    },
    write(draft: SessionDraft) {
      storage.setItem(prefix + draft.document.id, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
      storage.setItem(activeKey, draft.document.id);
      return Promise.resolve();
    },
  };
}
