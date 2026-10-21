import type { DesignReferenceImage, DesignImageResponse } from '../../application/projects/design-image.ts';
import { generatedImageData } from './design-image-contract.ts';
import { GEMINI_DESIGN_IMAGE_SYSTEM_PROMPT } from './design-image-prompt.ts';

export const GEMINI_IMAGE_MODEL = 'gemini-nano-banana-2.1';
export class ImageGenerationError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly providerStatus?: number) { super(message); }
}

export async function generateDesignImage(
  input: { specification: unknown; references: DesignReferenceImage[] }, apiKey: string, signal: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<DesignImageResponse> {
  const response = await fetcher('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      model: GEMINI_IMAGE_MODEL, store: false,
      generation_config: { thinking_level: 'high' },
      system_instruction: GEMINI_DESIGN_IMAGE_SYSTEM_PROMPT,
      input: [
        { type: 'text', text: 'Design specification (JSON):\n' + JSON.stringify(input.specification) },
        ...input.references.flatMap(image => [
          { type: 'text', text: `${image.view} view; camera: ${JSON.stringify(image.camera)}` },
          { type: 'image', mime_type: image.mimeType, data: image.data },
        ]),
        { type: 'text', text: 'Generate the finished professional photograph of this exact design.' },
      ],
      // ImageResponseFormat accepts JPEG output; PNG remains valid as an input image format.
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '4:3', image_size: '4K', delivery: 'inline' },
    }),
  });
  if (!response.ok) {
    // Never return or log the upstream body: it can contain request data or credentials.
    await response.body?.cancel();
    if (response.status === 429) {
      throw new ImageGenerationError(429, 'PROVIDER_LIMIT', 'Image generation is temporarily unavailable. Please try again later.', response.status);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ImageGenerationError(503, 'PROVIDER_CONFIGURATION', 'Image generation is temporarily unavailable. Please try again later.', response.status);
    }
    throw new ImageGenerationError(502, 'PROVIDER_ERROR', 'We couldn’t create your image. Please try again.', response.status);
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
