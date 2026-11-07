import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AnalyticsActor, ServerAnalytics } from '../../application/analytics/analytics-port';
import type { StoredAnalyticsEvent } from '../../domain/analytics/analytics-events';
import { cleanProperties } from '../../domain/analytics/analytics-validation';
import { currencyForCountry } from '../../domain/credits/credit-currency';
import { PUBLIC_SUPABASE_PROJECT } from '../supabase/project-config';
import { requestUser, type VerifiedUser } from '../supabase/server-identity';
import { safeError } from '../http/safe-error';

/** Where events are kept: `public.analytics_events` (supabase/migrations/*_analytics.sql), or memory on the dev server. */
export interface AnalyticsSink {
  insert(events: readonly StoredAnalyticsEvent[]): Promise<void>;
}

export interface AnalyticsEnvironment {
  SUPABASE_URL?: string | undefined;
  SUPABASE_SECRET_KEY?: string | undefined;
  CREDITS_MODE?: string | undefined;
  /** `false` turns event collection off: the endpoint accepts and drops everything. */
  ANALYTICS_ENABLED?: string | undefined;
}

export interface AnalyticsRuntime {
  readonly sink: AnalyticsSink;
  authenticate(request: Request): Promise<VerifiedUser | null>;
  /** The dev server's memory sink, for checks. Null in a deployed Worker. */
  readonly memory: StoredAnalyticsEvent[] | null;
}

/** A server event has no page: its locale, viewport and entry are left empty rather than guessed. */
const row = (e: StoredAnalyticsEvent) => {
  const page = e.source === 'browser' ? e.context : null;
  return {
    id: e.eventId, event: e.event, occurred_at: e.occurredAt, anonymous_id: e.anonymousId, user_id: e.userId,
    is_anonymous: e.isAnonymous, client_session_id: e.clientSessionId, design_id: e.designId, locale: page?.locale ?? null,
    country: e.country, currency: e.currency, viewport: page?.viewport ?? null, entry_source: page?.entrySource ?? null,
    referrer_path: page?.referrerPath ?? null, source: e.source, properties: e.properties,
  };
};

export function supabaseAnalyticsSink(client: SupabaseClient): AnalyticsSink {
  return {
    async insert(events) {
      if (!events.length) return;
      // A batch sent twice (a retried keepalive request) is stored once.
      const { error } = await client.from('analytics_events').upsert(events.map(row), { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    },
  };
}

let devRuntime: AnalyticsRuntime | null = null;
const runtimes = new WeakMap<object, AnalyticsRuntime | null>();

/** Once per Worker isolate. Null when collection is off or Supabase has no secret key here (events are then dropped). */
export function createAnalyticsRuntime(env: AnalyticsEnvironment, { allowTest = false } = {}): AnalyticsRuntime | null {
  if (env.ANALYTICS_ENABLED === 'false') return null;
  if (runtimes.has(env)) return runtimes.get(env)!;
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  if (!secret || (allowTest && env.CREDITS_MODE === 'test')) {
    if (!allowTest) { runtimes.set(env, null); return null; }
    if (devRuntime) return devRuntime;
    const memory: StoredAnalyticsEvent[] = [];
    const auth = createClient(PUBLIC_SUPABASE_PROJECT.url, PUBLIC_SUPABASE_PROJECT.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const verify = requestUser(auth);
    devRuntime = {
      memory, authenticate: request => verify(request).catch(() => null),
      sink: { async insert(events) { memory.push(...events); if (memory.length > 2000) memory.splice(0, memory.length - 2000); } },
    };
    return devRuntime;
  }
  const client = createClient(env.SUPABASE_URL?.trim() || PUBLIC_SUPABASE_PROJECT.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const runtime: AnalyticsRuntime = { sink: supabaseAnalyticsSink(client), authenticate: requestUser(client), memory: null };
  runtimes.set(env, runtime);
  return runtime;
}

/** Removes events older than 13 months (`analytics_prune`); 0 where Supabase has no secret key. */
export async function pruneAnalytics(env: AnalyticsEnvironment): Promise<number> {
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  if (!secret || env.ANALYTICS_ENABLED === 'false') return 0;
  const client = createClient(env.SUPABASE_URL?.trim() || PUBLIC_SUPABASE_PROJECT.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc('analytics_prune');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/** The country Cloudflare puts on a request (a browser cannot set it). */
export function requestCountry(request: Request): string | null {
  const cf = (request as Request & { cf?: { country?: unknown } }).cf;
  const country = typeof cf?.country === 'string' ? cf.country : request.headers.get('cf-ipcountry');
  return country && /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : null;
}

/**
 * Events the Worker records (payments, checkouts). Each is also a JSON log line, so Workers Logs shows revenue even
 * before the table is read. Writing never delays or fails the request: `drain` hands what is still being written to
 * the Worker's `waitUntil` (src/app/api-router.ts).
 */
export function createServerAnalytics(runtime: AnalyticsRuntime | null,
  log: (line: string) => void = line => console.info(line)): ServerAnalytics & { drain(): Promise<void> } {
  const pending = new Set<Promise<void>>();
  return {
    record(event, properties, actor: AnalyticsActor) {
      const clean = cleanProperties(properties);
      log(JSON.stringify({ event, ...clean }));
      if (!runtime) return;
      const country = actor.country ?? null;
      const stored: StoredAnalyticsEvent = {
        eventId: crypto.randomUUID(), event, occurredAt: new Date().toISOString(), anonymousId: actor.userId ?? 'server-side',
        clientSessionId: null, designId: null, userId: actor.userId, isAnonymous: actor.anonymous ?? false,
        country, currency: country ? currencyForCountry(country) : null, source: 'server',
        context: { locale: 'en', viewport: 'desktop', entrySource: 'direct', referrerPath: null },
        properties: clean as StoredAnalyticsEvent['properties'],
      };
      const write: Promise<void> = runtime.sink.insert([stored])
        .catch(error => console.error(JSON.stringify({ event: 'analytics_write_failed', error: safeError(error) })))
        .finally(() => pending.delete(write));
      pending.add(write);
    },
    drain: () => Promise.all([...pending]).then(() => undefined),
  };
}

const recorders = new WeakMap<object, ReturnType<typeof createServerAnalytics>>();
/** The server recorder for this environment, once per isolate (the credit service it is given to is cached too). */
export function serverAnalyticsFor(env: AnalyticsEnvironment, { allowTest = false } = {}) {
  let recorder = recorders.get(env);
  if (!recorder) { recorder = createServerAnalytics(createAnalyticsRuntime(env, { allowTest })); recorders.set(env, recorder); }
  return recorder;
}
