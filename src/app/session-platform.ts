import type { mountEditor } from '../presentation/editor/mount-editor';
import { createSessionAutosave } from '../application/projects/session-autosave';
import type { SessionDraft } from '../application/projects/session-autosave';
import { ProjectConflictError } from '../application/ports/project-repository';
import { sceneToProject } from '../application/projects/editor-mapper';
import { designLink } from './design-link';
import type { SessionPlatform } from './session-bootstrap';

/** Background persistence only. The existing editor and Share menu own all UI. */
export function connectSessions(platform: SessionPlatform, editor: ReturnType<typeof mountEditor>) {
  const { repository, drafts } = platform;
  let disposed = false;
  const capture = () => { editor.snapshot(); return structuredClone(editor.scene()); };
  const createSaver = (draft: SessionDraft, saved = false) => createSessionAutosave({
    ...draft, document: sceneToProject(draft.document, capture()),
  }, {
    repository, capture: base => sceneToProject(base, capture()), recover: drafts.write, status: () => undefined,
  }, saved);
  let saver = createSaver(platform.draft, platform.saved);
  let pending: Promise<unknown> = Promise.resolve();
  function ordered<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.catch(() => undefined).then(work);
    pending = result; return result;
  }
  async function flush() {
    try { await saver.flush(); } catch (error) {
      if (!(error instanceof ProjectConflictError)) throw error;
    }
    if (saver.blocked) {
      // Keep both versions automatically; never overwrite another tab's newer design.
      const document = sceneToProject(saver.document, capture());
      await saver.dispose();
      saver = createSaver({ document: { ...document, id: crypto.randomUUID() }, expectedRevision: null });
      await saver.flush();
    }
  }
  // Background failures stay quiet. Autosave keeps the browser draft and the next tick retries.
  const tick = () => {
    if (!disposed) void ordered(flush).catch(() => undefined);
  };
  const ready = ordered(flush).catch(() => undefined); // Creates the stored design as soon as the editor lands.
  const timer = window.setInterval(tick, 2500);
  const beforeUnload = (event: BeforeUnloadEvent) => {
    try { void drafts.write({ document: sceneToProject(saver.document, capture()), expectedRevision: saver.revision }); }
    catch { event.preventDefault(); }
  };
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('online', tick);
  return {
    ready,
    share: () => ordered(async () => {
      if (!repository) {
        if (platform.client) throw new Error('The cloud session could not be created.');
        return designLink(capture(), location.href);
      }
      await flush();
      const saved = await repository.visibility(saver.document.id, saver.revision!, 'public');
      saver.accept(saved);
      await drafts.write({ document: sceneToProject(saved.document, capture()), expectedRevision: saved.revision });
      const url = new URL(location.href); url.search = ''; url.hash = '';
      url.searchParams.set('session', saved.document.id);
      return url.href;
    }),
    dispose() {
      if (disposed) return;
      disposed = true; clearInterval(timer);
      window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('online', tick);
      void pending.finally(() => saver.dispose()).catch(() => undefined);
    },
  };
}
