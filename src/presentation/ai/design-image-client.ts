import type { DesignImageRequest, DesignImageResponse } from '../../application/projects/design-image';
import { DesignImageUserError } from './design-image-errors';

export async function requestDesignImage(input: DesignImageRequest, signal: AbortSignal): Promise<DesignImageResponse> {
  const response = await fetch('/api/design-images', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new DesignImageUserError(result?.error?.code);
  if (!result?.image?.data || !['image/png', 'image/jpeg', 'image/webp'].includes(result.image.mimeType)) {
    throw new DesignImageUserError('NO_IMAGE');
  }
  return result as DesignImageResponse;
}
