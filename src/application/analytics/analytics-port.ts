import type { AnalyticsEventName, AnalyticsProperties } from '../../domain/analytics/analytics-events';

/**
 * Product analytics as the editor sees it: fire and forget. A call never throws, never waits and never shows anything
 * to the person; the implementation (src/infrastructure/analytics/analytics-client.ts) batches and sends in the background.
 */
export interface AnalyticsPort {
  track<K extends AnalyticsEventName>(event: K, properties: AnalyticsProperties<K>): void;
  /** The design that later events are about (design_sessions.id), or null between designs. */
  setDesign(id: string | null): void;
  /** Sends what is queued now (the page is being hidden or closed). */
  flush(): void;
}
export type TrackEvent = AnalyticsPort['track'];

/** For editors mounted without analytics (tests, embedded previews, the examples). */
export const noopAnalytics: AnalyticsPort = Object.freeze({ track() {}, setDesign() {}, flush() {} });

/** Who a server-side event is about: a person the Worker verified, or nobody (a webhook for an order without one). */
export interface AnalyticsActor {
  readonly userId: string | null;
  readonly anonymous?: boolean | undefined;
  readonly country?: string | null | undefined;
}

/** Events the Worker records itself (payments, image results): what a browser could not be trusted to report. */
export interface ServerAnalytics {
  record<K extends AnalyticsEventName>(event: K, properties: AnalyticsProperties<K>, actor: AnalyticsActor): void;
}
export const noopServerAnalytics: ServerAnalytics = Object.freeze({ record() {} });
