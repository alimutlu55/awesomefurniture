import { handleDesignImage, type ImageServiceEnvironment } from '../infrastructure/gemini/design-image-handler';
import { createCreditRuntime, type CreditEnvironment } from '../infrastructure/credits/credit-environment';
import { handleCredits } from '../infrastructure/credits/credit-http';
import { featureCharge } from '../infrastructure/credits/image-charge';
import { createAccountRuntime, handleAccount, type AccountEnvironment } from '../infrastructure/account/account-http';
import { safeError } from '../infrastructure/http/safe-error';
import { createAnalyticsRuntime, pruneAnalytics, serverAnalyticsFor, type AnalyticsEnvironment } from '../infrastructure/analytics/analytics-store';
import { handleAnalytics } from '../infrastructure/analytics/analytics-http';

export interface ApiEnvironment extends ImageServiceEnvironment, CreditEnvironment, AccountEnvironment, AnalyticsEnvironment {}

interface ApiOptions {
  allowTest?: boolean;
  /** The Worker's `context.waitUntil`: analytics written after the response is sent. */
  waitUntil?: ((promise: Promise<unknown>) => void) | undefined;
}

/** Every `/api/*` request, in the Worker and in the Vite dev server alike. Null for any other path. */
export async function handleApi(request: Request, env: ApiEnvironment, { allowTest = false, waitUntil }: ApiOptions = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;
  if (url.pathname.startsWith('/api/account/')) return handleAccount(request, createAccountRuntime(env));
  if (url.pathname === '/api/analytics') return handleAnalytics(request, createAnalyticsRuntime(env, { allowTest }));
  const analytics = serverAnalyticsFor(env, { allowTest });
  try { return await handleRest(request, env, url, analytics, allowTest); }
  finally { waitUntil?.(analytics.drain()); }
}

async function handleRest(request: Request, env: ApiEnvironment, url: URL, analytics: ReturnType<typeof serverAnalyticsFor>, allowTest: boolean) {
  const credits = createCreditRuntime(env, url.origin, { allowTest, analytics });
  // An image is always paid for: without a credit runtime the charge refuses before Gemini is called.
  if (url.pathname === '/api/design-images') {
    return handleDesignImage(request, env, fetch, featureCharge(credits, 'ai-image'), { allowMock: allowTest });
  }
  return await handleCredits(request, credits)
    ?? Response.json({ error: { code: 'NOT_FOUND', message: 'Unknown API endpoint.' } }, { status: 404 });
}

/**
 * The schedule: gives back credits held by image requests that never finished (a crashed or timed-out Worker), asks
 * the payment provider about checkouts whose webhook has not arrived, and removes analytics events older than 13 months.
 * Each runs on its own, so one failing never stops the others.
 */
export async function sweepCredits(env: ApiEnvironment) {
  const analytics = serverAnalyticsFor(env);
  const service = createCreditRuntime(env, 'https://localhost', { analytics })?.service;
  const run = async (event: string, work: () => Promise<number>) => {
    try {
      const count = await work();
      if (count) console.info(JSON.stringify({ event, count }));
    } catch (error) {
      console.error(JSON.stringify({ event: event + '_failed', error: safeError(error) }));
    }
  };
  if (service) {
    await run('credits_released_stale', service.releaseStale);
    await run('credits_reconciled', service.reconcile);
  }
  await run('analytics_pruned', () => pruneAnalytics(env));
  await analytics.drain();
}
