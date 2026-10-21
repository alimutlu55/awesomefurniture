import type { DesignReferenceImage, DesignImageResponse } from '../../application/projects/design-image.ts';
import { generatedImageData } from './design-image-contract.ts';
import { modelSpecificationText } from './design-image-model-input.ts';
import { GEMINI_DESIGN_IMAGE_SYSTEM_PROMPT } from './design-image-prompt.ts';
import { ImageGenerationError } from './image-generation-error.ts';

export { ImageGenerationError };
export const GEMINI_IMAGE_MODEL = 'gemini-nano-banana-2.1';

const MAX_PROVIDER_ERROR_BYTES = 16 * 1024;
const MAX_PROVIDER_MESSAGE_CHARS = 300;

/**
 * Extracts only Google's canonical error status and a redacted, length-capped message from an
 * upstream failure. The raw body is never returned or logged: it is read up to a fixed size,
 * parsed as Google's `{ error: { status, message } }` shape and anything else is discarded.
 */
async function providerError(response: Response): Promise<{ reason: string | null; message: string | null }> {
  const none = { reason: null, message: null };
  const reader = response.body?.getReader();
  if (!reader) return none;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (bytes < MAX_PROVIDER_ERROR_BYTES) {
      const chunk = await reader.read();
      if (chunk.done) break;
      chunks.push(chunk.value); bytes += chunk.value.byteLength;
    }
  } catch { return none; } finally { await reader.cancel().catch(() => {}); }
  try {
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    const error = (JSON.parse(new TextDecoder().decode(body)) as { error?: { status?: unknown; code?: unknown; message?: unknown } })?.error;
    // Google APIs use `status` (e.g. INVALID_ARGUMENT); the Interactions API may use a string `code` instead.
    const rawReason = typeof error?.status === 'string' ? error.status : typeof error?.code === 'string' ? error.code : null;
    const reason = rawReason && /^[A-Za-z_]{1,64}$/.test(rawReason) ? rawReason : null;
    const message = typeof error?.message === 'string' ? error.message
      .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]')
      .replace(/[A-Za-z0-9+/=_-]{40,}/g, '[redacted]')
      .replace(/\s+/g, ' ').trim().slice(0, MAX_PROVIDER_MESSAGE_CHARS) : null;
    return { reason, message: message || null };
  } catch { return none; }
}

export async function generateDesignImage(
  input: { specification: unknown; references: DesignReferenceImage[] }, apiKey: string, signal: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<DesignImageResponse> {
  // Compacted and size-checked before spending a provider request.
  const specification = modelSpecificationText(input.specification);
  const response = await fetcher('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      model: GEMINI_IMAGE_MODEL, store: false,
      generation_config: { thinking_level: 'high' },
      system_instruction: GEMINI_DESIGN_IMAGE_SYSTEM_PROMPT,
      input: [
        { type: 'text', text: 'Design specification (JSON):\n' + specification },
        ...input.references.flatMap(image => [
          { type: 'text', text: `${image.view} view; camera: ${JSON.stringify(image.camera)}` },
          { type: 'image', mime_type: image.mimeType, data: image.data },
        ]),
        { type: 'text', text: 'Generate the finished professional photograph of this exact design.' },
      ],
      // ImageResponseFormat accepts JPEG output; PNG remains valid as an input image format.
      // Do not send `delivery`: Nano Banana 2.1 rejects it ("Image delivery mode is not supported.") and returns inline data by default.
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '4:3', image_size: '1K' },
    }),
  });
  if (!response.ok) {
    // Never return the upstream body; only Google's error status and a redacted message are kept for operator logs.
    const provider = await providerError(response);
    if (response.status === 429) {
      throw new ImageGenerationError(429, 'PROVIDER_LIMIT', 'Image generation is temporarily unavailable. Please try again later.', response.status, provider);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ImageGenerationError(503, 'PROVIDER_CONFIGURATION', 'Image generation is temporarily unavailable. Please try again later.', response.status, provider);
    }
    throw new ImageGenerationError(502, 'PROVIDER_ERROR', 'We couldn’t create your image. Please try again.', response.status, provider);
  }
  const result = await response.json() as { status?: string; steps?: { type: string; content?: { type: string; mime_type?: string; data?: string }[] }[] };
  const image = result.status === 'completed' ? result.steps?.filter(step => step.type === 'model_output')
    .flatMap(step => step.content ?? []).find(part => part.type === 'image' && part.data) : undefined;
  if (!image || !generatedImageData.safeParse(image.data).success
    || (image.mime_type !== 'image/png' && image.mime_type !== 'image/jpeg' && image.mime_type !== 'image/webp')) {
    throw new ImageGenerationError(502, 'NO_IMAGE', 'We couldn’t create your image. Please try again.');
  }
  return { model: GEMINI_IMAGE_MODEL, image: { mimeType: image.mime_type, data: image.data! } };
}
