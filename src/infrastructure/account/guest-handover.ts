import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasDesignWork } from '../../application/account/guest-work';
import type { MergeResult } from '../../application/account/account-merge';
import { adoptDrafts, forgetDrafts } from '../persistence/browser-drafts';
import { parseProject } from '../serialization/project-codec';

const KEY = 'wardrobe:account:guest';
interface Guest { readonly id: string; readonly accessToken: string; readonly refreshToken: string; readonly expiresAt: number }
interface Project { readonly url: string; readonly key: string }

/** What a guest left behind that is worth asking about: designs someone worked on, and credits. */
export interface GuestOffer {
  readonly designs: readonly { readonly id: string; readonly name: string }[];
  readonly credits: number;
}

/** What signing in found of the guest this browser had before. */
export type Handover =
  | { readonly status: 'none' }
  /** The guest has work (or credits): the person decides whether it joins the account. Nothing has moved. */
  | ({ readonly status: 'offer' } & GuestOffer)
  /** Not checked yet (offline, server busy): the next start tries again; the guest's designs are safe meanwhile. */
  | { readonly status: 'pending' }
  /** The guest could no longer be proven (its session was revoked): its designs stay with it. */
  | { readonly status: 'lost' };

const read = (storage: Storage): Guest | null => {
  try {
    const value = JSON.parse(storage.getItem(KEY) ?? 'null') as Guest | null;
    return value && typeof value.id === 'string' && typeof value.refreshToken === 'string' ? value : null;
  } catch { return null; }
};

/**
 * Remembers the guest identity right before signing in, so the account can be offered its designs and credits. A
 * signed-in person is not a guest: nothing is kept for them.
 */
export async function rememberGuest(client: SupabaseClient, storage: Storage) {
  const { data } = await client.auth.getSession();
  const session = data.session;
  if (!session?.user.is_anonymous) return;
  const guest: Guest = { id: session.user.id, accessToken: session.access_token, refreshToken: session.refresh_token,
    expiresAt: (session.expires_at ?? 0) * 1000 };
  storage.setItem(KEY, JSON.stringify(guest));
}

/** The guest's session was refreshed by the app while signing in was under way: keep the newest tokens. */
export function refreshGuest(storage: Storage, session: { user: { id: string }; access_token: string; refresh_token: string; expires_at?: number }) {
  const guest = read(storage);
  if (guest?.id !== session.user.id) return;
  storage.setItem(KEY, JSON.stringify({ ...guest, accessToken: session.access_token, refreshToken: session.refresh_token,
    expiresAt: (session.expires_at ?? 0) * 1000 }));
}

/** A current access token for the remembered guest, refreshing it with a separate client that saves nothing. */
async function guestToken(guest: Guest, project: Project, storage: Storage): Promise<string | null> {
  if (guest.expiresAt - Date.now() > 120_000) return guest.accessToken;
  const auth = createClient(project.url, project.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).auth;
  const { data, error } = await auth.refreshSession({ refresh_token: guest.refreshToken });
  // Auth refusing the token (revoked, used up) is final; a network failure is tried again on the next start.
  if (error) { if (error.status && error.status >= 400 && error.status < 500) return null; throw error; }
  if (!data.session) return null;
  refreshGuest(storage, data.session);
  return data.session.access_token;
}

/** Reads what the guest owns, as the guest (a guest may read its own rows), and keeps what is worth asking about. */
async function inspectGuest(project: Project, token: string, guestId: string, fetcher: typeof fetch): Promise<GuestOffer> {
  const headers = { apikey: project.key, Authorization: 'Bearer ' + token };
  const get = async (path: string) => {
    const response = await fetcher(`${project.url}/rest/v1/${path}`, { headers });
    if (!response.ok) throw new Error('Reading the guest failed: ' + response.status);
    return await response.json() as unknown;
  };
  const rows = await get(`design_sessions?select=id,name,document&owner_id=eq.${guestId}&deleted_at=is.null&order=updated_at.desc&limit=50`);
  const accounts = await get(`credit_accounts?select=balance&user_id=eq.${guestId}`);
  const designs = (Array.isArray(rows) ? rows as { id: string; name: string; document: unknown }[] : []).filter(row => {
    // A design that cannot be read is kept: asking about it is safer than leaving it behind.
    try { return hasDesignWork(parseProject(row.document)); } catch { return true; }
  }).map(row => ({ id: row.id, name: row.name }));
  const balance = Array.isArray(accounts) ? (accounts[0] as { balance?: unknown } | undefined)?.balance : 0;
  return { designs, credits: typeof balance === 'number' && balance > 0 ? balance : 0 };
}

/** The guest is settled (moved, declined or empty): forget it, and the designs this browser kept for it. */
function settle(storage: Storage, guest: Guest) {
  storage.removeItem(KEY);
  forgetDrafts(storage, guest.id);
}

/**
 * At start: if this browser signed in to an account since it was a guest, look at what the guest left. Nothing is
 * moved. A guest with only the default design and no credits is forgotten silently; one with work is offered to the
 * person (`adoptGuest` moves it, `declineGuest` lets it go).
 */
export async function handOver(client: SupabaseClient, project: Project, storage: Storage, fetcher: typeof fetch = fetch): Promise<Handover> {
  const guest = read(storage);
  if (!guest) return { status: 'none' };
  const { data } = await client.auth.getSession();
  const session = data.session;
  // Still the same guest: signing in was not finished (or is under way in a redirect). Keep it for when it is.
  if (!session || session.user.is_anonymous) {
    if (session && session.user.id !== guest.id) storage.removeItem(KEY);
    return { status: 'none' };
  }
  try {
    const token = await guestToken(guest, project, storage);
    if (!token) { storage.removeItem(KEY); return { status: 'lost' }; }
    const found = await inspectGuest(project, token, guest.id, fetcher);
    if (!found.designs.length && !found.credits) { settle(storage, guest); return { status: 'none' }; }
    return { status: 'offer', ...found };
  } catch { return { status: 'pending' }; }
}

/**
 * The person agreed: move the guest's designs and credits into the account (POST /api/account/merge) and its browser
 * drafts too, then forget the guest. Merging is idempotent, so two tabs doing it at once, or a retry, is safe.
 * Throws when it could not be done; the guest is still remembered and the offer stays.
 */
export async function adoptGuest(client: SupabaseClient, project: Project, storage: Storage, fetcher: typeof fetch = fetch): Promise<MergeResult> {
  const guest = read(storage);
  if (!guest) throw new Error('There is nothing to add.');
  const { data } = await client.auth.getSession();
  const session = data.session;
  if (!session || session.user.is_anonymous) throw new Error('Sign in first.');
  const token = await guestToken(guest, project, storage);
  if (!token) { storage.removeItem(KEY); throw new Error('The guest session has ended.'); }
  const response = await fetcher('/api/account/merge', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ guest: token }),
  });
  const body = await response.json().catch(() => null) as { designs?: unknown; credits?: unknown } | null;
  if (!response.ok || typeof body?.designs !== 'number' || typeof body.credits !== 'number') throw new Error('The designs could not be added yet.');
  adoptDrafts(storage, guest.id, session.user.id);
  storage.removeItem(KEY);
  return { designs: body.designs, credits: body.credits };
}

/** The person chose not to add the guest's work: it stays out of the account, and out of this browser. */
export function declineGuest(storage: Storage) {
  const guest = read(storage);
  if (guest) settle(storage, guest);
}
