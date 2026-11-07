import type { TrackEvent } from '../../application/analytics/analytics-port';
import { DesignImageUserError } from './design-image-errors';
import type { ImageStyle } from './generate-image-dialog';

export interface DesignImageAnalytics {
  track: TrackEvent;
  /** The furniture in the design now, by count only. */
  summary(): { product: 'wardrobe' | 'kitchen'; pieces: number };
}

/** The AI image funnel: opened, started, completed or failed (and how long it took), saved. */
export function imageFunnel(analytics: DesignImageAnalytics | null | undefined) {
  let started = 0, style: ImageStyle = 'realistic', category: 'wardrobe' | 'kitchen' = 'wardrobe', runs = 0;
  const track: TrackEvent = analytics?.track ?? (() => {});
  return {
    opened(hasResult: boolean) {
      const s = analytics?.summary();
      if (s) track('ai_image_dialog_opened', { category: s.product, piece_count: s.pieces, has_previous_result: hasResult });
    },
    started(next: ImageStyle, nextCategory: 'wardrobe' | 'kitchen') {
      style = next; category = nextCategory; started = Date.now();
      track('ai_image_generation_started', { style, category, is_retry: runs++ > 0 });
    },
    completed() { track('ai_image_generation_completed', { style, category, latency_ms: Date.now() - started }); },
    failed(error: unknown) {
      const outcome = error === 'cancelled' ? 'cancelled_by_user'
        : error instanceof DesignImageUserError && error.code ? error.code.toLowerCase() : 'unknown';
      track('ai_image_generation_failed', { style, outcome, elapsed_ms: Date.now() - started });
    },
    downloaded() { track('ai_image_downloaded', { style, category }); },
  };
}
