import type { AnalyticsPort } from '../../application/analytics/analytics-port';
import type { AnalyticsEntrySource, AnalyticsEnvelope, AnalyticsViewport } from '../../domain/analytics/analytics-events';
import { ANALYTICS_LIMITS, cleanProperties } from '../../domain/analytics/analytics-validation';

export interface AnalyticsClientOptions {
  /** False sends nothing (automated browsers, Do Not Track, Global Privacy Control): see src/app/analytics-platform.ts. */
  enabled: boolean;
  fetch: typeof fetch;
  /** The Supabase access token, so the Worker can tell a guest from an account without trusting the browser. */
  accessToken(): Promise<string | null>;
  local: Pick<Storage, 'getItem' | 'setItem'> | null;
  session: Pick<Storage, 'getItem' | 'setItem'> | null;
  context(): { locale: string; viewport: AnalyticsViewport };
  entry: { source: AnalyticsEntrySource; referrerPath: string | null };
  /** Page events that send the queue at once: `pagehide`, and `visibilitychange` when hidden. */
  page?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | undefined;
  endpoint?: string | undefined;
  intervalMs?: number | undefined;
  randomId?: (() => string) | undefined;
  now?: (() => number) | undefined;
}

const QUEUE_LIMIT = 200, BATCH_SIZE = 20;

function storedId(storage: AnalyticsClientOptions['local'], key: string, make: () => string) {
  try {
    const found = storage?.getItem(key);
    if (found && /^[A-Za-z0-9-]{8,128}$/.test(found)) return found;
    const id = make(); storage?.setItem(key, id); return id;
  } catch { return make(); }
}

/**
 * Batches events in memory and sends them first-party to `POST /api/analytics`: every 5 seconds, at 20 events, and when
 * the page is hidden (a `keepalive` request, which outlives the page). Failures are swallowed: analytics never
 * interrupts designing, and a batch that cannot be sent is tried once more with the next one.
 */
export function createAnalyticsClient(options: AnalyticsClientOptions): AnalyticsPort & { dispose(): void } {
  const randomId = options.randomId ?? (() => crypto.randomUUID()), now = options.now ?? Date.now;
  const endpoint = options.endpoint ?? '/api/analytics';
  const anonymousId = storedId(options.local, 'furnidraw.analytics.id', randomId);
  const clientSessionId = storedId(options.session, 'furnidraw.analytics.tab', randomId);
  let queue: { envelope: AnalyticsEnvelope; tries: number }[] = [];
  let designId: string | null = null, token: string | null = null, timer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;

  const refreshToken = () => options.accessToken().then(value => { token = value; }, () => undefined);
  async function send(batch: typeof queue, keepalive: boolean) {
    let body = JSON.stringify({ events: batch.map(item => item.envelope) });
    // A batch over the Worker's limit loses its newest events rather than being refused whole.
    while (body.length > ANALYTICS_LIMITS.batchBytes && batch.length > 1) {
      batch = batch.slice(0, -1); body = JSON.stringify({ events: batch.map(item => item.envelope) });
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    try {
      const response = await options.fetch(endpoint, { method: 'POST', headers, body, keepalive, credentials: 'same-origin' });
      if (response.status >= 500) throw new Error('retry');
    } catch {
      const retry = batch.filter(item => item.tries < 1).map(item => ({ ...item, tries: item.tries + 1 }));
      queue = [...retry, ...queue].slice(-QUEUE_LIMIT);
    }
  }
  function flush(keepalive = false) {
    if (!options.enabled || !queue.length) return;
    const batch = queue.splice(0, Math.min(queue.length, ANALYTICS_LIMITS.batchEvents));
    if (keepalive) { void send(batch, true); return; }
    void refreshToken().then(() => send(batch, false));
  }
  const onHide = () => flush(true);
  const onVisibility = () => { if (options.page?.visibilityState === 'hidden') flush(true); };
  if (options.enabled) {
    void refreshToken();
    timer = setInterval(() => flush(), options.intervalMs ?? 5000);
    options.page?.addEventListener('pagehide', onHide);
    options.page?.addEventListener('visibilitychange', onVisibility);
  }
  return {
    track(event, properties) {
      if (!options.enabled || disposed) return;
      try {
        const context = options.context();
        queue.push({ tries: 0, envelope: {
          eventId: randomId(), event, occurredAt: new Date(now()).toISOString(), anonymousId, clientSessionId, designId,
          context: { ...context, entrySource: options.entry.source, referrerPath: options.entry.referrerPath },
          properties: cleanProperties(properties) as AnalyticsEnvelope['properties'],
        } });
        if (queue.length > QUEUE_LIMIT) queue = queue.slice(-QUEUE_LIMIT);
        if (queue.length >= BATCH_SIZE) flush();
      } catch { /* Analytics never breaks the editor. */ }
    },
    setDesign(id) { designId = id; },
    flush: () => flush(true),
    dispose() {
      if (disposed) return;
      flush(true); disposed = true;
      if (timer) clearInterval(timer);
      options.page?.removeEventListener('pagehide', onHide);
      options.page?.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
