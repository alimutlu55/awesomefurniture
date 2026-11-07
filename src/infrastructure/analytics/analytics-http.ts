import type { StoredAnalyticsEvent } from '../../domain/analytics/analytics-events';
import { ANALYTICS_LIMITS, parseEnvelope } from '../../domain/analytics/analytics-validation';
import { currencyForCountry } from '../../domain/credits/credit-currency';
import { readBoundedText, RequestBodyError } from '../http/request-body';
import { safeError } from '../http/safe-error';
import { requestCountry, type AnalyticsRuntime } from './analytics-store';

const answer = (status: number, body?: unknown) => body === undefined
  ? new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })
  : Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * `POST /api/analytics`: a batch of at most 25 events from the editor, at most 32 KiB. Each event is checked against the
 * registry and cleaned (src/domain/analytics/analytics-validation.ts); the person and their country come from the
 * request, never from the batch. Unknown or malformed events are dropped, not refused, so one bad event never loses a batch.
 */
export async function handleAnalytics(request: Request, runtime: AnalyticsRuntime | null): Promise<Response> {
  if (request.method !== 'POST') { const r = answer(405); r.headers.set('Allow', 'POST'); return r; }
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return answer(403);
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') return answer(415);
  let raw: unknown;
  try { raw = JSON.parse(await readBoundedText(request, ANALYTICS_LIMITS.batchBytes)); }
  catch (error) { return answer(error instanceof RequestBodyError ? error.status : 400); }
  const list = (raw as { events?: unknown } | null)?.events;
  if (!Array.isArray(list) || list.length > ANALYTICS_LIMITS.batchEvents) return answer(400);
  // Collection is off here (no secret key, or ANALYTICS_ENABLED=false): accepted and dropped, so browsers never retry.
  if (!runtime) return answer(202, { accepted: 0 });
  const now = Date.now(), envelopes = list.map(item => parseEnvelope(item, now)).filter(e => e !== null);
  if (!envelopes.length) return answer(202, { accepted: 0 });
  const user = await runtime.authenticate(request).catch(() => null), country = requestCountry(request);
  const events: StoredAnalyticsEvent[] = envelopes.map(e => ({
    ...e, userId: user?.id ?? null, isAnonymous: user ? user.anonymous : true,
    country, currency: country ? currencyForCountry(country) : null, source: 'browser',
  }));
  try { await runtime.sink.insert(events); }
  catch (error) {
    console.error(JSON.stringify({ event: 'analytics_write_failed', count: events.length, error: safeError(error) }));
    return answer(503);
  }
  return answer(202, { accepted: events.length });
}
