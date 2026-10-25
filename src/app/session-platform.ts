import type { mountEditor } from '../presentation/editor/mount-editor';
import { createSessionAutosave } from '../application/projects/session-autosave';
import type { SessionDraft } from '../application/projects/session-autosave';
import { ProjectConflictError } from '../application/ports/project-repository';
import { sceneToProject } from '../application/projects/editor-mapper';
import { designLink } from './design-link';
import type { SessionPlatform } from './session-bootstrap';
import { DesignUnavailableError } from '../application/projects/design-collection';

/** Background persistence only. The existing editor and Share menu own all UI. */
export function connectSessions(platform: SessionPlatform, editor: ReturnType<typeof mountEditor>, recovered?: (id: string) => void) {
  const { repository, drafts } = platform;
  drafts.activate?.(platform.draft.document.id);
  let disposed = false;
  const capture = () => { editor.snapshot(); return structuredClone(editor.scene()); };
  const createSaver = (draft: SessionDraft, saved = false) => createSessionAutosave({
    ...draft, document: sceneToProject(draft.document, capture()),
  }, {
    repository, capture: base => sceneToProject(base, capture()),
    recover: draft => drafts.write(draft, false), status: () => undefined,
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
      if (repository && !await repository.load(saver.document.id)) throw new DesignUnavailableError();
      // Keep both versions automatically; never overwrite another tab's newer design.
      const document = sceneToProject(saver.document, capture());
      await saver.dispose();
      const name = document.name.slice(0, 102) + ' · Recovered copy';
      saver = createSaver({ document: { ...document, name, id: crypto.randomUUID() }, expectedRevision: null });
      await drafts.write({ document: sceneToProject(saver.document, capture()), expectedRevision: null }, false);
      drafts.activate?.(saver.document.id);
      recovered?.(saver.document.id);
      await saver.flush();
    }
  }
  // Background failures stay quiet. Autosave keeps the browser draft and the next tick retries.
  const tick = () => {
    // After signing in or out (here or in another tab) the old identity can no longer save; the page reloads.
    if (!disposed && !platform.switched?.()) void ordered(flush).catch(() => undefined);
  };
  const ready = ordered(flush).catch(() => undefined); // Creates the stored design as soon as the editor lands.
  const timer = window.setInterval(tick, 2500);
  const beforeUnload = (event: BeforeUnloadEvent) => {
    try { void drafts.write({ document: sceneToProject(saver.document, capture()), expectedRevision: saver.revision }, false); }
    catch { event.preventDefault(); }
  };
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('online', tick);
  function stop() {
    disposed = true; clearInterval(timer);
    window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('online', tick);
  }
  return {
    ready,
    get id() { return saver.document.id; },
    /** Caller freezes editor input until this resolves; no later capture may read a new editor. */
    close: () => ordered(async () => {
      const document = sceneToProject(saver.document, capture());
      await drafts.write({ document, expectedRevision: saver.revision }, false);
      let saved = false;
      try { await flush(); saved = !!repository; }
      catch (error) { if (error instanceof DesignUnavailableError) throw error; }
      const draft = { document: sceneToProject(saver.document, capture()), expectedRevision: saver.revision };
      // This also surfaces local recovery failure instead of leaving a blank editor.
      await drafts.write(draft, false);
      stop(); await saver.dispose();
      return { draft, saved };
    }),
    share: () => ordered(async () => {
      if (!repository) {
        if (platform.client) throw new Error('The cloud session could not be created.');
        return designLink(capture(), location.href);
      }
      await flush();
      const saved = await repository.visibility(saver.document.id, saver.revision!, 'public');
      saver.accept(saved);
      await drafts.write({ document: sceneToProject(saved.document, capture()), expectedRevision: saved.revision }, false);
      const url = new URL(location.href); url.search = ''; url.hash = '';
      url.searchParams.set('session', saved.document.id);
      return url.href;
    }),
    dispose(): Promise<void> {
      stop();
      return pending.catch(() => undefined).then(() => saver.dispose());
    },
  };
}
