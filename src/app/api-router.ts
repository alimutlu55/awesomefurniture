import { handleDesignImage, type ImageServiceEnvironment } from '../infrastructure/gemini/design-image-handler';
import { createCreditRuntime, type CreditEnvironment } from '../infrastructure/credits/credit-environment';
import { handleCredits } from '../infrastructure/credits/credit-http';
import { featureCharge } from '../infrastructure/credits/image-charge';

export interface ApiEnvironment extends ImageServiceEnvironment, CreditEnvironment {}

/** Every `/api/*` request, in the Worker and in the Vite dev server alike. Null for any other path. */
export async function handleApi(request: Request, env: ApiEnvironment, { allowTest = false } = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;
  const credits = createCreditRuntime(env, url.origin, { allowTest });
  // An image is always paid for: without a credit runtime the charge refuses before Gemini is called.
  if (url.pathname === '/api/design-images') return handleDesignImage(request, env, fetch, featureCharge(credits, 'ai-image'));
  return await handleCredits(request, credits)
    ?? Response.json({ error: { code: 'NOT_FOUND', message: 'Unknown API endpoint.' } }, { status: 404 });
}

/** The schedule: gives back credits held by image requests that never finished (a crashed or timed-out Worker). */
export async function sweepCredits(env: ApiEnvironment) {
  const released = await createCreditRuntime(env, 'https://localhost')?.service.releaseStale() ?? 0;
  if (released) console.info(JSON.stringify({ event: 'credits_released_stale', released }));
}
