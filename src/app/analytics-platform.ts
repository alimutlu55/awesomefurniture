import { createAnalyticsClient } from '../infrastructure/analytics/analytics-client';
import { viewportClass, type AnalyticsEntrySource, type AnalyticsEventMap } from '../domain/analytics/analytics-events';
import { cleanPath } from '../domain/analytics/analytics-validation';
import { currentLanguage } from '../presentation/i18n/language';
import type { SessionPlatform } from './session-bootstrap';

type Navigator = Pick<globalThis.Navigator, 'webdriver'> & { doNotTrack?: string | null; globalPrivacyControl?: boolean };

/**
 * Analytics stay off in automated browsers (Playwright checks would fill the table; `?analytics=1` turns them on for a
 * check of the pipeline itself) and for visitors who ask not to be tracked (Do Not Track, Global Privacy Control).
 */
export function analyticsAllowed(url: URL, nav: Navigator): boolean {
  if (url.searchParams.get('analytics') === '0') return false;
  if (nav.webdriver && url.searchParams.get('analytics') !== '1') return false;
  return !(nav.doNotTrack === '1' || nav.globalPrivacyControl === true);
}

/** How the visitor arrived: a link in the address, one of this site's own pages, another site, or typed in. */
export function entryOf(url: URL, referrer: string): { source: AnalyticsEntrySource; referrerPath: string | null } {
  let from: URL | null = null;
  try { from = referrer ? new URL(referrer) : null; } catch { /* not a URL */ }
  const sameSite = !!from && from.origin === url.origin;
  const referrerPath = sameSite ? cleanPath(from!.pathname) : null;
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has('design')) return { source: 'design_link', referrerPath };
  if (hash.has('spec')) return { source: 'spec_link', referrerPath };
  if (url.searchParams.has('session') || url.searchParams.has('project')) return { source: 'shared_session', referrerPath };
  if (sameSite && referrerPath && !/^\/editor(?:\.html|\/)?/.test(referrerPath)) return { source: 'marketing_page', referrerPath };
  return { source: from && !sameSite ? 'external' : 'direct', referrerPath };
}

/** What `editor_session_started` says about this visit, read once at start-up. */
export function sessionStart(url: URL, platform: Pick<SessionPlatform, 'client' | 'draft' | 'saved' | 'deferCreation'>):
  AnalyticsEventMap['editor_session_started'] {
  const hash = new URLSearchParams(url.hash.slice(1)), utm = (name: string) => url.searchParams.get('utm_' + name)?.slice(0, 64) ?? null;
  const entry_type = hash.has('design') ? 'design_hash' : hash.has('spec') ? 'spec_hash'
    : url.searchParams.get('view') === 'designs' ? 'library'
      : url.searchParams.has('session') ? 'shared_session'
        : platform.saved ? 'restored_cloud' : platform.deferCreation ? 'new' : 'restored_draft';
  return { entry_type, utm_source: utm('source'), utm_medium: utm('medium'), utm_campaign: utm('campaign'), cloud_available: !!platform.client };
}

/** The editor's analytics, sending to this site's own Worker (src/infrastructure/analytics/analytics-http.ts). */
export function createAnalyticsPlatform(url: URL, platform: () => Pick<SessionPlatform, 'client'> | null, page: Document = document) {
  const storage = (name: 'localStorage' | 'sessionStorage') => { try { return window[name]; } catch { return null; } };
  return createAnalyticsClient({
    enabled: analyticsAllowed(url, navigator as Navigator),
    fetch: (input, init) => fetch(input, init),
    accessToken: async () => (await platform()?.client?.auth.getSession())?.data.session?.access_token ?? null,
    local: storage('localStorage'), session: storage('sessionStorage'),
    context: () => ({ locale: currentLanguage(), viewport: viewportClass(window.innerWidth) }),
    entry: entryOf(url, page.referrer), page,
  });
}
