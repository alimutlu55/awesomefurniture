/**
 * How a fitting's zone is drawn in the layout diagrams: a colour and a short label.
 *
 * Both the fitting kind (drawer, rail...) and its purpose (underwear, seasonal...) may give a style.
 * The one with the higher `priority` wins, separately for colour and label: if the winner has no
 * label, the other's label is used. Use the named levels below, never a bare number.
 */
export interface ZoneStyle {
  readonly color?: string;
  readonly label?: string;
  /** Label for a front-facing hanging fitting. */
  readonly frontLabel?: string;
  readonly priority: number;
}

export const ZONE_PRIORITY = Object.freeze({
  /** Free space is always shown as free, whatever purpose it has. */
  free: 4,
  /** A purpose that changes what the zone is: adjustable, spare shelf, underwear, trousers, handbags. */
  purpose: 3,
  /** Hanging fittings stay hanging even when they hold seasonal clothes. */
  hanging: 2,
  /** A purpose that only tints the zone: seasonal, linen, luggage. */
  tint: 1,
  /** A plain fitting: drawer, shelf, shoe rack. */
  fitting: 0,
});

/** The colour and label a zone shows, from its fitting kind's style and its purpose's style. */
export function resolveZone(kind: ZoneStyle | undefined, purpose: ZoneStyle | undefined, front: boolean, fallback: { color: string; label: string }) {
  const ranked = [kind, purpose].filter((s): s is ZoneStyle => !!s).sort((a, b) => b.priority - a.priority);
  const pick = (field: 'color' | 'label') => ranked.find(s => s[field] !== undefined)?.[field];
  const frontLabel = front && kind?.frontLabel !== undefined && (purpose?.label === undefined || kind.priority >= purpose.priority) ? kind.frontLabel : undefined;
  return { color: pick('color') ?? fallback.color, label: frontLabel ?? pick('label') ?? fallback.label };
}
