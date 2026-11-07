import { isAnalyticsEvent, isServerEvent, type AnalyticsEntrySource, type AnalyticsEnvelope, type AnalyticsViewport } from './analytics-events';

/** Limits the Worker holds a browser batch to (docs/analytics.md). */
export const ANALYTICS_LIMITS = { batchEvents: 25, batchBytes: 32 * 1024, propertyBytes: 4096, stringLength: 120, listLength: 24 } as const;

const ID = /^[A-Za-z0-9-]{8,128}$/;
const KEY = /^[a-z][a-z0-9_]{0,47}$/;
/** Names that must never carry a value, whatever an event declares. */
const FORBIDDEN_KEY = /(?:e_?mail|password|passcode|(?:^|_)otp|secret|phone|address|prompt|(?:^|_)token$|(?:^|_)name$|(?:^|_)ip$)/;
const VIEWPORTS: readonly AnalyticsViewport[] = ['phone', 'tablet', 'desktop'];
const SOURCES: readonly AnalyticsEntrySource[] = ['direct', 'marketing_page', 'shared_session', 'design_link', 'spec_link', 'external'];

type Clean = string | number | boolean | null | readonly string[];

/** A string that could be personal (an email, a URL with a query) is dropped rather than shortened. */
function cleanString(value: string): string | undefined {
  if (/@|[?#]|\bhttps?:/i.test(value)) return undefined;
  return value.slice(0, ANALYTICS_LIMITS.stringLength);
}

/**
 * Flat, summary-only properties: keys in snake_case, values that are short strings, finite numbers, booleans, null or
 * short lists of strings. Anything else is left out, so a careless call can never store a design or a person's details.
 */
export function cleanProperties(input: unknown): Record<string, Clean> {
  const out: Record<string, Clean> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input).slice(0, 32)) {
    if (!KEY.test(key) || FORBIDDEN_KEY.test(key)) continue;
    if (value === null || typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number') { if (Number.isFinite(value)) out[key] = Math.round(value * 1000) / 1000; }
    else if (typeof value === 'string') { const text = cleanString(value); if (text !== undefined) out[key] = text; }
    else if (Array.isArray(value)) {
      out[key] = value.filter((v): v is string => typeof v === 'string').map(cleanString)
        .filter((v): v is string => v !== undefined).slice(0, ANALYTICS_LIMITS.listLength);
    }
  }
  if (JSON.stringify(out).length > ANALYTICS_LIMITS.propertyBytes) return {};
  return out;
}

/** A referrer reduced to its path on this site (no query, no fragment, no other host). */
export function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  const path = value.split(/[?#]/)[0]!;
  return /^\/[A-Za-z0-9/_.-]{0,199}$/.test(path) ? path : null;
}

const iso = (value: unknown, now: number) => {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  // A clock far off is replaced by the time received; a day either way covers queued offline events.
  return Number.isFinite(time) && Math.abs(time - now) < 86_400_000 ? new Date(time).toISOString() : new Date(now).toISOString();
};

/** One event from a browser, checked; null when it is not one this app sends. Server-only events are refused. */
export function parseEnvelope(input: unknown, now = Date.now()): AnalyticsEnvelope | null {
  if (!input || typeof input !== 'object') return null;
  const e = input as Record<string, unknown>, c = (e.context ?? {}) as Record<string, unknown>;
  if (!isAnalyticsEvent(e.event) || isServerEvent(e.event)) return null;
  if (typeof e.eventId !== 'string' || !ID.test(e.eventId) || typeof e.anonymousId !== 'string' || !ID.test(e.anonymousId)
    || typeof e.clientSessionId !== 'string' || !ID.test(e.clientSessionId)) return null;
  const occurredAt = iso(e.occurredAt, now);
  if (!occurredAt) return null;
  return {
    eventId: e.eventId, event: e.event, occurredAt, anonymousId: e.anonymousId, clientSessionId: e.clientSessionId,
    designId: typeof e.designId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(e.designId) ? e.designId : null,
    context: {
      locale: typeof c.locale === 'string' && /^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(c.locale) ? c.locale : 'en',
      viewport: VIEWPORTS.includes(c.viewport as AnalyticsViewport) ? c.viewport as AnalyticsViewport : 'desktop',
      entrySource: SOURCES.includes(c.entrySource as AnalyticsEntrySource) ? c.entrySource as AnalyticsEntrySource : 'direct',
      referrerPath: cleanPath(c.referrerPath),
    },
    properties: cleanProperties(e.properties) as AnalyticsEnvelope['properties'],
  };
}
