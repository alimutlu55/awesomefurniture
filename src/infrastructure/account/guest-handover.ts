import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { adoptDrafts } from '../persistence/browser-drafts';

const KEY = 'wardrobe:account:guest';
interface Guest { readonly id: string; readonly accessToken: string; readonly refreshToken: string; readonly expiresAt: number }

/** What signing in did with the guest this browser had before. */
export type Handover =
  | { readonly status: 'none' }
  /** Its designs and credits are now the account's. */
  | { readonly status: 'merged'; readonly designs: number; readonly credits: number }
  /** Not yet (offline, server busy): the next start tries again; the guest's designs are safe meanwhile. */
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
 * Remembers the guest identity right before signing in, so the account can take over its designs and credits. A
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
async function guestToken(guest: Guest, url: string, key: string, storage: Storage): Promise<string | null> {
  if (guest.expiresAt - Date.now() > 120_000) return guest.accessToken;
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).auth;
  const { data, error } = await auth.refreshSession({ refresh_token: guest.refreshToken });
  // Auth refusing the token (revoked, used up) is final; a network failure is tried again on the next start.
  if (error) { if (error.status && error.status >= 400 && error.status < 500) return null; throw error; }
  if (!data.session) return null;
  refreshGuest(storage, data.session);
  return data.session.access_token;
}

/**
 * At start: if this browser signed in to an account since it was a guest, ask the server to move the guest's designs
 * and credits into the account (POST /api/account/merge), then move its browser drafts too. Merging is idempotent, so
 * two tabs doing it at once, or a retry after a failure, is safe.
 */
export async function handOver(client: SupabaseClient, project: { url: string; key: string }, storage: Storage, fetcher: typeof fetch = fetch): Promise<Handover> {
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
    const token = await guestToken(guest, project.url, project.key, storage);
    if (!token) { storage.removeItem(KEY); return { status: 'lost' }; }
    const response = await fetcher('/api/account/merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ guest: token }),
    });
    const body = await response.json().catch(() => null) as { designs?: unknown; credits?: unknown; error?: { code?: string } } | null;
    if (response.ok && typeof body?.designs === 'number' && typeof body.credits === 'number') {
      adoptDrafts(storage, guest.id, session.user.id);
      storage.removeItem(KEY);
      return { status: 'merged', designs: body.designs, credits: body.credits };
    }
    if (body?.error?.code === 'GUEST_REQUIRED') { storage.removeItem(KEY); return { status: 'lost' }; }
    return { status: 'pending' };
  } catch { return { status: 'pending' }; }
}
