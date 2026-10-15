import { ProjectConflictError } from '../ports/project-repository';
import type { ProjectRepository, StoredProject } from '../ports/project-repository';
import type { ProjectDocument } from '../../domain/project/project';

export interface SessionDraft { document: ProjectDocument; expectedRevision: number | null }
export interface AutosavePorts {
  repository: ProjectRepository | null;
  capture(base: ProjectDocument): ProjectDocument;
  recover(draft: SessionDraft): Promise<void>;
  status(message: string): void;
}

/** One in-flight write. A stale snapshot is never resubmitted with a newer revision. */
export function createSessionAutosave(initial: SessionDraft, ports: AutosavePorts, initiallySaved = false) {
  let base = initial.document;
  let revision = initial.expectedRevision;
  let savedKey = initiallySaved ? JSON.stringify(base) : '';
  let recoveredKey = '';
  let inFlight: Promise<void> | null = null;
  let blocked = false;
  let disposed = false;

  async function perform() {
    if (disposed) return;
    const document = ports.capture(base);
    const key = JSON.stringify(document);
    const recoveryKey = `${revision}:${key}`;
    if (recoveryKey !== recoveredKey) {
      await ports.recover({ document, expectedRevision: revision });
      recoveredKey = recoveryKey;
    }
    if (blocked) return;
    if (!ports.repository) { ports.status('Saved locally'); return; }
    if (key === savedKey) {
      ports.status('Saved');
      return;
    }
    ports.status('Saving…');
    try {
      const saved = await ports.repository.save(document, revision);
      base = saved.document;
      revision = saved.revision;
      savedKey = key;
      await ports.recover({ document: ports.capture(base), expectedRevision: revision });
      recoveredKey = ''; // Capture again next tick, including edits made during the write.
      ports.status('Saved');
    } catch (error) {
      blocked = error instanceof ProjectConflictError;
      ports.status(blocked ? 'Concurrent edit detected'
        : 'Cloud save failed · browser draft kept · retry when connected');
      throw error;
    }
  }
  return {
    get document() { return base; },
    get revision() { return revision; },
    get blocked() { return blocked; },
    async flush() {
      if (disposed) return;
      const operation = (inFlight ?? Promise.resolve()).catch(() => undefined).then(perform);
      inFlight = operation;
      try { await operation; } finally { if (inFlight === operation) inFlight = null; }
    },
    accept(saved: StoredProject) { base = saved.document; revision = saved.revision; savedKey = JSON.stringify(saved.document); },
    async dispose() { disposed = true; if (inFlight) await inFlight.catch(() => undefined); },
  };
}
