import { createBrowserSupabase } from '../infrastructure/supabase/client';
import { createBrowserDrafts } from '../infrastructure/persistence/browser-drafts';
import { loadPublicSession, SupabaseProjectRepository } from '../infrastructure/supabase/project-repository';
import { createProject } from '../domain/project/project';
import type { SessionDraft } from '../application/projects/session-autosave';

/** A persistent anonymous identity owns the design; no account screen is required. */
export async function prepareSession(url: URL) {
  const client = createBrowserSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
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
  const repository = client && user ? new SupabaseProjectRepository(client, user.id) : null;
  const drafts = createBrowserDrafts(localStorage, user?.id ?? 'guest');
  const hasInline = /(?:^#|&)(?:design|spec)=/.test(url.hash);
  const requestedId = hasInline ? null : url.searchParams.get('session') ?? url.searchParams.get('project');
  let draft: SessionDraft | null = null;
  let saved = false;
  if (requestedId && repository && client) {
    const owned = await repository.load(requestedId);
    if (owned) {
      draft = drafts.read(requestedId) ?? { document: owned.document, expectedRevision: owned.revision };
      saved = draft.expectedRevision === owned.revision && JSON.stringify(draft.document) === JSON.stringify(owned.document);
    } else {
      const shared = await loadPublicSession(client, requestedId);
      // The recipient sees the shared design but edits an independently owned session.
      draft = { document: { ...shared.document, id: crypto.randomUUID() }, expectedRevision: null };
    }
  } else if (!hasInline) {
    try { draft = drafts.read(); } catch {
      warning = 'The previous browser draft could not be read. It is still stored.';
    }
    if (draft && repository) {
      try {
        const stored = await repository.load(draft.document.id);
        saved = !!stored && draft.expectedRevision === stored.revision && JSON.stringify(draft.document) === JSON.stringify(stored.document);
      } catch { warning = 'Cloud saving is unavailable. Your browser draft has been restored.'; }
    }
    if (!draft && user) {
      const guest = createBrowserDrafts(localStorage, 'guest').read();
      if (guest) draft = { document: { ...guest.document, id: crypto.randomUUID() }, expectedRevision: null };
    }
  }
  draft ??= { document: createProject(crypto.randomUUID(), 'Wardrobe design'), expectedRevision: null };
  return { client, user, repository, drafts, draft, saved, warning };
}
export type SessionPlatform = Awaited<ReturnType<typeof prepareSession>>;
