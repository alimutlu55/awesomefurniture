import { createBrowserSupabase } from '../infrastructure/supabase/client';
import { createBrowserDrafts } from '../infrastructure/persistence/browser-drafts';
import { loadPublicSession, SupabaseProjectRepository } from '../infrastructure/supabase/project-repository';
import { resolveSupabaseProject } from '../infrastructure/supabase/project-config';
import { handOver, refreshGuest, type Handover } from '../infrastructure/account/guest-handover';
import { createProject } from '../domain/project/project';
import type { SessionDraft } from '../application/projects/session-autosave';

/**
 * A persistent anonymous identity owns the design until the person signs in; no account is required to design. After
 * signing in, a guest that has real work is offered to the person (nothing moves unless they agree), and the editor
 * opens the account's own designs meanwhile.
 */
export async function prepareSession(url: URL) {
  const project = resolveSupabaseProject(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const client = createBrowserSupabase(project.url, project.publishableKey);
  async function identity() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session.user;
    const created = await client.auth.signInAnonymously();
    if (created.error) throw created.error;
    return created.data.user;
  }
  // Two fresh tabs must reuse the same persisted identity instead of racing sign-ins.
  let warning: string | null = null;
  let user: Awaited<ReturnType<typeof identity>> = null;
  try {
    user = navigator.locks
      ? await navigator.locks.request('wardrobe-identity', identity) : await identity();
  } catch { warning = 'Cloud saving is unavailable. Your design can still be edited in this browser.'; }
  const handover: Handover = client && user ? await handOver(client, { url: project.url, key: project.publishableKey }, localStorage) : { status: 'none' };
  // Another tab signed in or out: this one stops saving as the old identity and reloads (src/app/account-platform.ts).
  let switched = false;
  client?.auth.onAuthStateChange((event, session) => {
    if (user && (session?.user.id ?? null) !== user.id) switched = true;
    if (event === 'TOKEN_REFRESHED' && session?.user.is_anonymous) refreshGuest(localStorage, session);
  });
  const repository = client && user ? new SupabaseProjectRepository(client, user.id) : null;
  const drafts = createBrowserDrafts(localStorage, user?.id ?? 'guest');
  const hasInline = /(?:^#|&)(?:design|spec)=/.test(url.hash);
  const requestedId = hasInline ? null : url.searchParams.get('session') ?? url.searchParams.get('project');
  let draft: SessionDraft | null = null;
  let saved = false;
  /** The design that was open last, if it still exists; otherwise the account's newest design; otherwise nothing. */
  async function restore() {
    try { draft = drafts.read(); } catch {
      warning = 'The previous browser draft could not be read. It is still stored.';
    }
    if (draft && repository) {
      try {
        const stored = await repository.load(draft.document.id);
        // Saved before, and no longer in the cloud: it was removed (here or on another device).
        if (!stored && draft.expectedRevision !== null) draft = null;
        else saved = !!stored && draft.expectedRevision === stored.revision && JSON.stringify(draft.document) === JSON.stringify(stored.document);
      } catch { warning = 'Cloud saving is unavailable. Your browser draft has been restored.'; }
    }
    if (!draft && repository) {
      try {
        const newest = (await repository.list())[0];
        const stored = newest ? await repository.load(newest.id) : null;
        if (stored) { draft = { document: stored.document, expectedRevision: stored.revision }; saved = true; }
      } catch { /* a new design opens instead */ }
    }
    if (!draft && user) {
      const guest = createBrowserDrafts(localStorage, 'guest').read();
      if (guest) draft = { document: { ...guest.document, id: crypto.randomUUID() }, expectedRevision: null };
    }
  }
  if (requestedId && repository && client) {
    let owned;
    try { owned = await repository.load(requestedId); }
    catch (error) {
      draft = drafts.read(requestedId);
      if (!draft) throw error;
      warning = 'Cloud saving is unavailable. Your browser draft has been restored.';
    }
    if (owned) {
      draft = drafts.read(requestedId) ?? { document: owned.document, expectedRevision: owned.revision };
      saved = draft.expectedRevision === owned.revision && JSON.stringify(draft.document) === JSON.stringify(owned.document);
    } else if (!draft && (handover.status === 'pending' || handover.status === 'offer')) {
      // The design is still the guest's until the person decides: open the account's own work meanwhile.
      await restore();
    } else if (!draft) {
      try {
        const shared = await loadPublicSession(client, requestedId);
        // The recipient sees the shared design but edits an independently owned session.
        draft = { document: {
          ...shared.document, id: crypto.randomUUID(), name: shared.document.name.slice(0, 113) + ' · Copy',
        }, expectedRevision: null };
      } catch {
        // Removed, private or never shared (an old address, or one from before signing in): open the person's own work.
        await restore();
      }
    }
  } else if (requestedId) {
    draft = drafts.read(requestedId);
    if (!draft) throw new Error('This design is not available in this browser while cloud saving is unavailable.');
  } else if (!hasInline) {
    await restore();
  }
  const deferCreation = !draft || (!saved && draft.expectedRevision === null && !drafts.read(draft.document.id));
  draft ??= { document: createProject(crypto.randomUUID(), 'Untitled design'), expectedRevision: null };
  return { client, user, repository, drafts, draft, saved, deferCreation, warning, handover, switched: () => switched };
}
export type SessionPlatform = Awaited<ReturnType<typeof prepareSession>>;
