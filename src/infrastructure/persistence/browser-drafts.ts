import type { SessionDraft } from '../../application/projects/session-autosave';
import type { ProjectSummary } from '../../application/ports/project-repository';
import { parseProject } from '../serialization/project-codec';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** The reverted 3D editor saved ceiling fields the original editor cannot read. */
function withoutRetiredCeilings(document: unknown): unknown {
  if (!object(document) || (document.schemaVersion !== 1 && document.schemaVersion !== 2) || !object(document.studio)) return document;
  const ceilings = document.studio.ceilings;
  if (!Array.isArray(ceilings)) return document;
  const shaped = ceilings.some(ceiling => object(ceiling) && 'shape' in ceiling);
  // Version 2 belonged to the reverted ceiling-shape editor. Only recover that
  // known format; the normal parser still rejects unrelated future documents.
  if (document.schemaVersion === 2 && !shaped) return document;
  const retired = (ceiling: unknown) => object(ceiling) && ('outline' in ceiling || 'sections' in ceiling);
  if (!shaped && !ceilings.some(retired)) return document;
  return { ...document, schemaVersion: 1, studio: { ...document.studio, ceilings: ceilings.filter(ceiling => !retired(ceiling)).map(ceiling => {
    if (!object(ceiling) || !('shape' in ceiling)) return ceiling;
    const { shape: _retiredShape, ...supported } = ceiling;
    return supported;
  }) } };
}

/** Scoped to the identity. Drafts survive navigation, failures and cloud conflicts. */
export function createBrowserDrafts(storage: Storage, scope: string) {
  const prefix = `wardrobe:draft:${scope}:`;
  const activeKey = `wardrobe:active:${scope}`;
  const deletedKey = (id: string) => `wardrobe:deleted:${scope}:${id}`;
  const previewKey = (id: string) => `wardrobe:preview:${scope}:${id}`;
  function load(key: string) {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as { document: unknown; expectedRevision: unknown; savedAt?: string };
    const revision = value.expectedRevision;
    if (revision !== null && (!Number.isInteger(revision) || Number(revision) < 1)) throw new Error('Invalid recovery revision.');
    // Shaped ceilings now save an outline too: recover only drafts that do not read as they are.
    let recovered = value.document, document: ReturnType<typeof parseProject>;
    try { document = parseProject(recovered); } catch (error) {
      recovered = withoutRetiredCeilings(value.document);
      if (recovered === value.document) throw error;
      document = parseProject(recovered);
    }
    if (recovered !== value.document) {
      // Preserve the complete original before replacing only the incompatible draft.
      const suffix = object(value.document) && value.document.schemaVersion === 2 ? 'before-ceiling-shape-rollback' : 'before-ceiling-rollback';
      const backup = `wardrobe:recovery:${scope}:${document.id}:${suffix}`;
      if (storage.getItem(backup) === null) storage.setItem(backup, raw);
      storage.setItem(key, JSON.stringify({ ...value, document }));
    }
    return { ...value, document, expectedRevision: revision as number | null };
  }
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
          const value = load(key);
          if (!value) continue;
          const document = value.document;
          if (storage.getItem(deletedKey(document.id))) continue;
          records.push({ id: document.id, name: document.name, revision: value.expectedRevision ?? 0, updatedAt: value.savedAt ?? '' });
        } catch { /* Preserve unreadable drafts for manual recovery; never erase them. */ }
      }
      return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    read(id = storage.getItem(activeKey)): SessionDraft | null {
      if (!id) return null;
      if (storage.getItem(deletedKey(id))) return null;
      const value = load(prefix + id);
      return value ? { document: value.document, expectedRevision: value.expectedRevision } : null;
    },
    write(draft: SessionDraft, activate = true) {
      if (storage.getItem(deletedKey(draft.document.id))) throw new Error('This design was deleted in another tab.');
      storage.setItem(prefix + draft.document.id, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
      if (activate) storage.setItem(activeKey, draft.document.id);
      return Promise.resolve();
    },
  };
}
