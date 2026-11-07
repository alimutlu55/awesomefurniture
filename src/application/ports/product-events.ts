/**
 * Product events: what people do with the product, for measuring it (which features are used, where designs stall). The
 * application reports events through this port; infrastructure decides where they go (nowhere, the console, an
 * analytics store). Events carry no personal data and no design content: names, counts and kinds only.
 */
export type EventValue = string | number | boolean;

export interface ProductEvents {
  track(name: string, props?: Readonly<Record<string, EventValue>>): void;
}

/** The default: events go nowhere. */
export const NO_EVENTS: ProductEvents = { track() { /* not recorded */ } };
