import { mountEditor } from '../presentation/editor/mount-editor';
import { bindPageViewport } from '../presentation/editor/page-viewport';
import { mountDesignLibrary } from '../presentation/designs/design-library';
import { designPreview } from '../presentation/designs/design-preview';
import { createDesignCollection } from '../application/projects/design-collection';
import type { OpenDesign } from '../application/projects/design-collection';
import { projectToScene } from '../application/projects/editor-mapper';
import { connectSessions } from './session-platform';
import type { SessionPlatform } from './session-bootstrap';
import { createCreditPlatform, type CheckoutReturn } from './credit-platform';
import { createAccountPlatform } from './account-platform';
import { createLoadingState, paintLoading } from '../presentation/components/loading-state';

interface WorkspaceOptions {
  root: HTMLElement;
  platform: SessionPlatform;
  changed(editor: ReturnType<typeof mountEditor> | null): void;
  initialLink(): Promise<void>;
  /** A checkout that just sent the person back here, for the first editor to confirm. */
  checkout?: CheckoutReturn | null;
}

/** The app owns document navigation. A fresh editor mount owns each design's Undo. */
export function createDesignWorkspace({ root, platform, changed, initialLink, checkout = null }: WorkspaceOptions) {
  const collection = createDesignCollection(platform.repository, platform.drafts, () => crypto.randomUUID());
  let mounted: ReturnType<typeof mountEditor> | null = null;
  let sessions: ReturnType<typeof connectSessions> | null = null;
  let unbindViewport = () => {};
  let current: OpenDesign = { draft: platform.draft, saved: platform.saved };
  let currentId: string | null = platform.drafts.read()?.document.id ?? null;
  let pending: Promise<unknown> = Promise.resolve();
  let disposed = false, navigation = 0;
  const previewCache = new Map<string, string>();
  const credits = createCreditPlatform(platform, {
    designId: () => currentId,
  }, checkout);
  const account = createAccountPlatform(platform);
  const transition = createLoadingState(root);
  function ordered<T>(work: () => Promise<T>): Promise<T> {
    const operation = pending.catch(() => undefined).then(async () => {
      if (disposed) throw new Error('The workspace has closed.');
      return work();
    });
    pending = operation;
    return operation;
  }
  function route(kind: 'designs' | 'editor', replace = false) {
    const url = new URL(location.href); url.search = ''; url.hash = '';
    if (kind === 'designs') url.searchParams.set('view', 'designs');
    else if (currentId) url.searchParams.set('session', currentId);
    if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](null, '', url);
  }
  async function refresh() {
    library.loading(true);
    try {
      const result = await collection.list();
      library.update({ ...result, currentId, localOnly: !platform.repository });
    } catch (error) {
      library.error(error instanceof Error ? error.message : 'Your designs could not be loaded. Try again.');
    } finally { library.loading(false); }
  }
  async function preview(id: string): Promise<string | null> {
    const cached = previewCache.get(id) ?? platform.drafts.preview(id);
    if (cached) return cached;
    const local = platform.drafts.read(id);
    const document = local?.document ?? (await platform.repository?.load(id))?.document;
    if (!document) return null;
    const image = designPreview(document); previewCache.set(id, image); return image;
  }
  function savePreview(id: string) {
    const image = mounted?.preview();
    if (!image) return;
    previewCache.set(id, image);
    try { platform.drafts.preview(id, image); } catch { /* Cache space never blocks saving a design. */ }
  }
  async function release(deleted = false) {
    if (!mounted || !sessions) return;
    root.inert = true;
    try {
      if (!deleted) {
        current = await sessions.close(); currentId = current.draft.document.id;
        savePreview(currentId);
      } else await sessions.dispose();
      mounted.dispose(); unbindViewport();
      mounted = null; sessions = null; changed(null); root.hidden = true;
    } finally { root.inert = false; }
  }
  async function attach(design: OpenDesign, initialize = false) {
    root.hidden = false;
    let connection: ReturnType<typeof connectSessions> | null = null;
    const editor = mountEditor({
      root, initialScene:projectToScene(design.draft.document), credits, account,
      onBack: () => {
        if (transition.active) return;
        transition.start();
        void ordered(async () => {
          await paintLoading(root);
          try { await showDesigns(); }
          catch (error) { mounted?.notify(error instanceof Error ? error.message : 'Your design could not be saved. Try again.'); }
          finally { transition.stop(); }
        });
      },
      shareLink: async () => {
        if (!connection) throw new Error('Your design is still opening. Try again.');
        const url = await connection.share(); currentId = connection.id; route('editor', true); return url;
      },
    });
    mounted = editor; current = design; currentId = design.draft.document.id; changed(editor);
    unbindViewport = bindPageViewport(root, window);
    try {
      if (initialize) await initialLink();
      platform.drafts.activate(currentId);
      connection = connectSessions({ ...platform, ...design }, editor, id => {
        currentId = id;
        if (!library.visible) route('editor', true);
        editor.notify('Another tab changed this design. Your work is kept in a recovered copy.');
      });
      sessions = connection;
      await connection.ready;
      currentId = connection.id;
    } catch (error) {
      await connection?.dispose(); editor.dispose(); unbindViewport(); mounted = null; sessions = null; changed(null);
      throw error;
    }
  }
  async function showDesigns(push = true) {
    await release();
    root.hidden = true;
    library.show();
    if (push) route('designs');
    await refresh();
  }
  async function open(id: string, push = true) {
    // Validate the destination before disposing a working editor.
    const design = await collection.open(id);
    await release();
    const previous = current;
    try {
      await attach(design);
      library.hide();
      if (push) route('editor');
    } catch (error) {
      if (!library.visible) await attach(previous);
      throw error;
    }
  }
  const library = mountDesignLibrary(root.ownerDocument, {
    open: id => ordered(() => open(id)),
    create: name => ordered(async () => {
      const design = await collection.create(name);
      await attach(design); library.hide(); route('editor');
    }),
    rename: (id, name) => ordered(async () => {
      const renamed = await collection.rename(id, name);
      if (currentId === id) current = renamed;
      await refresh();
    }),
    duplicate: id => ordered(async () => {
      const copy = await collection.duplicate(id);
      const image = previewCache.get(id) ?? platform.drafts.preview(id);
      if (image) {
        previewCache.set(copy.draft.document.id, image);
        try { platform.drafts.preview(copy.draft.document.id, image); } catch { /* Optional cache. */ }
      }
      await refresh();
    }),
    remove: (id, revision) => ordered(async () => {
      await collection.remove(id, revision);
      if (currentId === id) currentId = null;
      previewCache.delete(id); await refresh();
    }),
    refresh: () => ordered(refresh), preview,
  });
  async function followLocation(token: number, url: URL) {
    if (token !== navigation) return;
    try {
      if (url.searchParams.get('view') === 'designs') { await showDesigns(false); route('designs', true); }
      else {
        const id = url.searchParams.get('session') ?? url.searchParams.get('project');
        if (id && (id !== currentId || !mounted)) {
          const design = await collection.open(id);
          if (token !== navigation) return;
          await release(); await attach(design); library.hide(); route('editor', true);
        } else if (!mounted && currentId) await open(currentId, false);
        else if (!mounted) await showDesigns(false);
      }
    } catch (error) {
      if (mounted) { route('editor', true); mounted.notify('This design could not be opened. Your current design is still available.'); }
      else {
        library.show(); route('designs', true); await refresh();
        library.error(error instanceof Error ? error.message : 'This design could not be opened.');
      }
    }
  }
  const popstate = () => {
    const token = ++navigation, url = new URL(location.href);
    transition.start(); library.loading(true);
    void ordered(() => followLocation(token, url)).finally(() => { transition.stop(); library.loading(false); });
  };
  const storage = () => {
    if (disposed) return;
    void ordered(async () => {
      const id = sessions?.id ?? currentId;
      if (id && platform.drafts.deleted(id)) {
        await release(true); currentId = null; library.show(); route('designs', true); await refresh();
      } else if (library.visible) await refresh();
    });
  };
  window.addEventListener('popstate', popstate);
  window.addEventListener('storage', storage);
  return {
    async start() {
      if (new URL(location.href).searchParams.get('view') === 'designs') {
        root.hidden = true; library.show(); await refresh();
      } else {
        await attach(current, true);
        route('editor', true);
        if (platform.warning) mounted?.notify(platform.warning);
      }
    },
    dispose() {
      disposed = true;
      window.removeEventListener('popstate', popstate); window.removeEventListener('storage', storage);
      // Keep the mounted scene alive until pending captures settle.
      void pending.catch(() => undefined).then(async () => {
        await sessions?.dispose(); mounted?.dispose(); unbindViewport(); changed(null); library.dispose();
      });
    },
  };
}
