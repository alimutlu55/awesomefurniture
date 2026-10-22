import type { ConfigurationForImage } from '../../application/projects/configuration-summary';
import type { DecorSwatchReference } from '../../application/projects/design-image';
import { selectedDecors } from '../../application/projects/selected-decors';

/** Local, curated manufacturer assets only. Missing swatches leave the exact textual SKU manifest intact. */
export async function loadDecorSwatches(specification: ConfigurationForImage, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<DecorSwatchReference[]> {
  const results = await Promise.all(selectedDecors(specification).filter(({ sku }) => sku.pbr.textureUrl).slice(0, 8).map(async ({ sku }) => {
    try {
      const response = await fetcher(sku.pbr.textureUrl!, { signal });
      if (!response.ok || !response.headers.get('Content-Type')?.startsWith('image/')) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 1024 * 1024) return null;
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const mimeType = response.headers.get('Content-Type')!.split(';')[0];
      if (mimeType !== 'image/webp' && mimeType !== 'image/jpeg' && mimeType !== 'image/png') return null;
      return { decorId: sku.id, mimeType, data: btoa(binary) } as DecorSwatchReference;
    } catch { return null; }
  }));
  return results.filter((value): value is DecorSwatchReference => value !== null);
}
