import type { DesignImageRequest, DesignImageResponse } from '../../application/projects/design-image';
import { DesignImageUserError } from './design-image-errors';

export function isDebugMode(): boolean {
  if (typeof __LOG_LEVEL__ !== 'undefined' && __LOG_LEVEL__.toLowerCase() === 'debug') return true;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('debug') || params.get('mode') === 'debug') return true;
    try {
      if (window.localStorage?.getItem('debug') === 'true') return true;
    } catch {
      // Ignore storage errors in restrictive environments
    }
  }
  return false;
}

export async function requestDesignImage(input: DesignImageRequest, signal: AbortSignal): Promise<DesignImageResponse> {
  const debug = isDebugMode();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (debug) headers['X-Debug-Mode'] = 'true';

  const response = await fetch('/api/design-images', {
    method: 'POST', headers, body: JSON.stringify(input), signal,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) throw new DesignImageUserError(result?.error?.code);
  if (!result?.image?.data || !['image/png', 'image/jpeg', 'image/webp'].includes(result.image.mimeType)) {
    throw new DesignImageUserError('NO_IMAGE');
  }
  return result as DesignImageResponse;
}
