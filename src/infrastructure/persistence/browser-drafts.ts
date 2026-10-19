import type { SessionDraft } from '../../application/projects/session-autosave';
import type { ProjectSummary } from '../../application/ports/project-repository';
import { parseProject } from '../serialization/project-codec';

/** Scoped to the identity. Drafts survive navigation, failures and cloud conflicts. */
export function createBrowserDrafts(storage: Storage, scope: string) {
  const prefix = `wardrobe:draft:${scope}:`;
  const activeKey = `wardrobe:active:${scope}`;
  const deletedKey = (id: string) => `wardrobe:deleted:${scope}:${id}`;
  const previewKey = (id: string) => `wardrobe:preview:${scope}:${id}`;
  return {
    deleted: (id: string) => storage.getItem(deletedKey(id)) !== null,
    activate(id: string) { storage.setItem(activeKey, id); },
    remove(id: string) {
      // Write the tombstone first: other tabs must stop saving this document.
      storage.setItem(deletedKey(id), 'true');
      storage.removeItem(prefix + id);
      storage.removeItem(previewKey(id));
      if (storage.getItem(activeKey) === id) storage.removeItem(activeKey);
    },
    preview(id: string, image?: string): string | null {
      if (image !== undefined) storage.setItem(previewKey(id), image);
      return storage.getItem(previewKey(id));
    },
    list(): readonly ProjectSummary[] {
      const records: ProjectSummary[] = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (!key?.startsWith(prefix)) continue;
        try {
          const value = JSON.parse(storage.getItem(key)!) as { document: unknown; expectedRevision: number | null; savedAt?: string };
          const document = parseProject(value.document);
          if (storage.getItem(deletedKey(document.id))) continue;
          records.push({ id: document.id, name: document.name, revision: value.expectedRevision ?? 0, updatedAt: value.savedAt ?? '' });
        } catch { /* Preserve unreadable drafts for manual recovery; never erase them. */ }
      }
      return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    read(id = storage.getItem(activeKey)): SessionDraft | null {
      if (!id) return null;
      if (storage.getItem(deletedKey(id))) return null;
      const raw = storage.getItem(prefix + id);
      if (!raw) return null;
      const value = JSON.parse(raw) as { document: unknown; expectedRevision: unknown };
      const revision = value.expectedRevision;
      if (revision !== null && (!Number.isInteger(revision) || Number(revision) < 1)) throw new Error('Invalid recovery revision.');
      return { document: parseProject(value.document), expectedRevision: revision as number | null };
    },
    write(draft: SessionDraft, activate = true) {
      if (storage.getItem(deletedKey(draft.document.id))) throw new Error('This design was deleted in another tab.');
      storage.setItem(prefix + draft.document.id, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
      if (activate) storage.setItem(activeKey, draft.document.id);
      return Promise.resolve();
    },
  };
}
