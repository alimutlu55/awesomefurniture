import { MAX_REQUEST_BYTES, parseDesignImageRequest } from './design-image-contract.ts';
import { generateDesignImage, ImageGenerationError } from './generate-design-image.ts';

export interface ImageServiceEnvironment {
  GEMINI_API_KEY?: string | undefined;
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

export async function handleDesignImage(request: Request, env: ImageServiceEnvironment, fetcher: typeof fetch = fetch) {
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
  if (!env.GEMINI_API_KEY?.trim()) return failure(503, 'NOT_CONFIGURED', 'Image generation is temporarily unavailable. Please try again later.');
  try {
    const input = parseDesignImageRequest(await readRequest(request));
    if (!input) return failure(400, 'INVALID_DESIGN', 'A valid design specification and three distinct reference views are required.');
    const limit = await env.AI_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'local' });
    if (!limit.success) {
      const response = failure(429, 'RATE_LIMITED', 'Please wait a minute before generating another image.');
      response.headers.set('Retry-After', '60');
      return response;
    }
    const timeout = AbortSignal.timeout(150_000), signal = AbortSignal.any([request.signal, timeout]);
    try { return json(await generateDesignImage(input, env.GEMINI_API_KEY, signal, fetcher)); }
    catch (error) {
      if (timeout.aborted) return failure(504, 'TIMEOUT', 'Image generation took too long. Please try again.');
      if (request.signal.aborted) return failure(499, 'CANCELLED', 'Image generation was cancelled.');
      throw error;
    }
  } catch (error) {
    if (error instanceof ImageGenerationError) return failure(error.status, error.code, error.message);
    return failure(502, 'GENERATION_FAILED', 'Image generation is temporarily unavailable. Please try again.');
  }
}
