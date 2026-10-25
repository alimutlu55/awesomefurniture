import { MAX_REQUEST_BYTES, parseDesignImageRequest } from './design-image-contract.ts';
import { generateDesignImage, ImageGenerationError, GEMINI_IMAGE_MODEL } from './generate-design-image.ts';
import { CreditError } from '../../application/credits/credit-service.ts';
import { creditFailure } from '../credits/credit-http.ts';
import type { ChargeHold, FeatureCharge } from '../credits/image-charge.ts';

export interface ImageServiceEnvironment {
  GEMINI_API_KEY?: string | undefined;
  LOG_LEVEL?: string | undefined;
  AI_MOCK_DELAY_MS?: string | number | undefined;
  AI_RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const failure = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

/** Bounded streaming read also protects requests that omit or lie about Content-Length. */
async function readRequest(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) throw new ImageGenerationError(413, 'TOO_LARGE', 'The design images are too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ImageGenerationError(400, 'INVALID_REQUEST', 'A design and three reference views are required.');
  const decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new ImageGenerationError(413, 'TOO_LARGE', 'The design images are too large.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    if (error instanceof ImageGenerationError) throw error;
    throw new ImageGenerationError(400, 'INVALID_JSON', 'The design request contains invalid JSON.');
  } finally { reader.releaseLock(); }
}

/** `charge` takes credits for each image (src/app/api-router.ts always passes it); a failed or cancelled generation refunds them. */
export async function handleDesignImage(request: Request, env: ImageServiceEnvironment, fetcher: typeof fetch = fetch, charge?: FeatureCharge) {
  if (request.method !== 'POST') {
    const response = failure(405, 'METHOD_NOT_ALLOWED', 'Use POST to generate a design image.');
    response.headers.set('Allow', 'POST');
    return response;
  }
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return failure(403, 'ORIGIN_REJECTED', 'Generate images from the design editor.');
  }
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') {
    return failure(415, 'INVALID_CONTENT_TYPE', 'Send the design as JSON.');
  }
  const isDebug = env.LOG_LEVEL?.toLowerCase() === 'debug'
    || new URL(request.url).searchParams.has('debug')
    || request.headers.get('x-debug-mode') === 'true';

  if (!isDebug && !env.GEMINI_API_KEY?.trim()) return failure(503, 'NOT_CONFIGURED', 'Image generation is temporarily unavailable. Please try again later.');
  try {
    const input = parseDesignImageRequest(await readRequest(request));
    if (!input) return failure(400, 'INVALID_DESIGN', 'A valid design specification and three distinct reference views are required.');
    const limit = await env.AI_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'local' });
    if (!limit.success) {
      const response = failure(429, 'RATE_LIMITED', 'Please wait a minute before generating another image.');
      response.headers.set('Retry-After', '60');
      return response;
    }
    let hold: ChargeHold | null = null;
    try { hold = await charge?.begin(request) ?? null; }
    catch (error) { if (error instanceof CreditError) return creditFailure(error); throw error; }
    const timeout = AbortSignal.timeout(150_000), signal = AbortSignal.any([request.signal, timeout]);
    const credits = hold ? { credits: { balance: hold.balance, cost: hold.cost } } : {};
    try {
      if (isDebug) {
        if (signal.aborted) throw new DOMException('The operation was aborted', 'AbortError');
        const delay = typeof env.AI_MOCK_DELAY_MS !== 'undefined' ? Number(env.AI_MOCK_DELAY_MS) : 10_000;
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted', 'AbortError'));
          }, { once: true });
        });
        const ref = input.references.find(r => r.view === 'front') ?? input.references[0]!;
        // A mock is not an image anyone paid for: a live ledger gives the credits back; test mode keeps them to show the flow.
        if (hold?.mode === 'live') await hold.refund('mock'); else await hold?.commit({ mock: 1 });
        return json({
          model: GEMINI_IMAGE_MODEL,
          image: { mimeType: ref.mimeType, data: ref.data },
          text: 'Photorealistic visualization of configured board decors in natural daylight (Debug Mock).',
          ...credits,
        });
      }
      const { usage, ...result } = await generateDesignImage(input, env.GEMINI_API_KEY!, signal, fetcher, env.LOG_LEVEL);
      await hold?.commit(usage);
      return json({ ...result, ...credits });
    } catch (error) {
      await hold?.refund(timeout.aborted ? 'timeout' : request.signal.aborted ? 'cancelled' : error instanceof ImageGenerationError ? error.code : 'failed');
      if (timeout.aborted) return failure(504, 'TIMEOUT', 'Image generation took too long. Please try again.');
      if (request.signal.aborted) return failure(499, 'CANCELLED', 'Image generation was cancelled.');
      throw error;
    }
  } catch (error) {
    const requestId = crypto.randomUUID();
    // Failure logs never include errors, provider bodies or keys. Request payloads are logged
    // separately at the provider boundary for debugging; providerReason/providerMessage are redacted and capped.
    const known = error instanceof ImageGenerationError ? error : null;
    console.error(JSON.stringify({ event: 'design_image_failed', requestId, model: GEMINI_IMAGE_MODEL,
      code: known ? known.code : 'GENERATION_FAILED',
      providerStatus: known?.providerStatus ?? null,
      providerReason: known?.provider?.reason ?? null,
      providerMessage: known?.provider?.message ?? null }));
    const response = error instanceof ImageGenerationError ? failure(error.status, error.code, error.message)
      : failure(502, 'GENERATION_FAILED', 'Image generation is temporarily unavailable. Please try again.');
    response.headers.set('X-Request-ID', requestId);
    return response;
  }
}
