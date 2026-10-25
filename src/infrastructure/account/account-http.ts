import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { AccountError, mergeGuest, type AccountErrorCode, type AccountStore } from '../../application/account/account-merge';
import { PUBLIC_SUPABASE_PROJECT } from '../supabase/project-config';
import { verifyAccessToken, type VerifiedUser } from '../supabase/server-identity';

/** Server settings: the same Supabase secret key the credit ledger uses. */
export interface AccountEnvironment {
  SUPABASE_URL?: string | undefined;
  SUPABASE_SECRET_KEY?: string | undefined;
}

export interface AccountRuntime {
  readonly store: AccountStore;
  verify(token: string): Promise<VerifiedUser | null>;
}

const STATUS: Record<AccountErrorCode, number> = { SIGN_IN_REQUIRED: 401, GUEST_REQUIRED: 401, INVALID_REQUEST: 400, ACCOUNTS_UNAVAILABLE: 503 };
const MAX_BODY = 16 * 1024;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const failure = (status: number, code: string, message: string, extra: object = {}) => json({ error: { code, message, ...extra } }, status);

/** account_merge in Supabase Postgres, granted to service_role only. */
export function createSupabaseAccountStore(client: SupabaseClient): AccountStore {
  const result = z.object({ designs: z.number().int().min(0), credits: z.number().int() });
  return {
    async merge(guestId, accountId) {
      const { data, error } = await client.rpc('account_merge', { p_guest: guestId, p_account: accountId });
      if (error) throw new Error(`Account merge failed: ${error.code ?? ''} ${error.message}`);
      return result.parse(data);
    },
  };
}

const runtimes = new WeakMap<object, AccountRuntime | null>();
/** Once per Worker isolate. Null without the secret key: merging then answers 503 and the browser tries again later. */
export function createAccountRuntime(env: AccountEnvironment): AccountRuntime | null {
  if (runtimes.has(env)) return runtimes.get(env)!;
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  const client = secret
    ? createClient(env.SUPABASE_URL?.trim() || PUBLIC_SUPABASE_PROJECT.url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  const runtime = client ? { store: createSupabaseAccountStore(client), verify: (token: string) => verifyAccessToken(client, token) } : null;
  runtimes.set(env, runtime);
  return runtime;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw new AccountError('INVALID_REQUEST', 'Send JSON.');
  const text = await request.text();
  if (text.length > MAX_BODY) throw new AccountError('INVALID_REQUEST', 'The request is too large.');
  try {
    const value = JSON.parse(text) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* answered below */ }
  throw new AccountError('INVALID_REQUEST', 'The request contains invalid JSON.');
}
const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  return !(origin && origin !== new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
};

/** `/api/account/*`. `POST /api/account/merge` moves the guest's designs and credits into the signed-in account. */
export async function handleAccount(request: Request, runtime: AccountRuntime | null): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path !== '/api/account/merge') return failure(404, 'NOT_FOUND', 'Unknown account endpoint.');
  if (request.method !== 'POST') return failure(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  if (!sameOrigin(request)) return failure(403, 'ORIGIN_REJECTED', 'Sign in from the design editor.');
  try {
    if (!runtime) throw new AccountError('ACCOUNTS_UNAVAILABLE', 'Accounts are temporarily unavailable. Please try again later.');
    const body = await readJson(request);
    const token = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
    const account = token ? await runtime.verify(token) : null;
    const guest = typeof body.guest === 'string' && body.guest.length < 8192 ? await runtime.verify(body.guest) : null;
    return json(await mergeGuest(runtime.store, account, guest));
  } catch (error) {
    if (error instanceof AccountError) return failure(STATUS[error.code], error.code, error.message);
    const requestId = crypto.randomUUID();
    console.error(JSON.stringify({ event: 'account_merge_failed', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    const response = failure(500, 'ACCOUNT_MERGE_FAILED', 'Your designs could not be moved yet. They will be moved the next time you open the editor.', { reason: requestId });
    response.headers.set('X-Request-ID', requestId);
    return response;
  }
}
