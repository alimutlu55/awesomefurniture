import type { DesignImageRequest, DesignImageResponse } from '../../application/projects/design-image';

export async function requestDesignImage(input: DesignImageRequest, signal: AbortSignal): Promise<DesignImageResponse> {
  const response = await fetch('/api/design-images', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message ?? 'Image generation is unavailable. Please try again.');
  if (!result?.image?.data || !['image/png', 'image/jpeg', 'image/webp'].includes(result.image.mimeType)) {
    throw new Error('The image service returned no usable image.');
  }
  return result as DesignImageResponse;
}
