import { mapBoundary } from './surface-outline';
import { roomHeight, type Studio, type StudioCeiling } from './studio';

/** The low quarter of a panel keeps the lift grip clear of corner dots, the + and depth grip. */
export function outerEdgePoint(c: StudioCeiling) {
  if (c.run === 'across') return c.profile.at(-1)!;
  const panels = c.profile.slice(0, -1).flatMap((a, k) => {
    const b = c.profile[k + 1]!;
    return b.t > a.t ? [{ t: a.t + (b.t - a.t) * .25, y: a.y + (b.y - a.y) * .25 }] : [];
  });
  return panels.sort((a, b) => a.y - b.y)[0] ?? c.profile[0]!;
}
export const outerEdgeHeight = (c: StudioCeiling) => outerEdgePoint(c).y + (c.run === 'along' ? c.edgeRise ?? 0 : 0);
export const edgeHeight = (c: StudioCeiling, y: number) => y + (c.run === 'along' ? c.edgeRise ?? 0 : 0);

/** Lift the free boundary while the supporting wall edge stays at its existing height. */
export function liftCeilingOuterEdge(studio: Studio, id: string, amount: number): Studio | null {
  const c = studio.ceilings?.find(c => c.id === id);
  if (!c || !Number.isFinite(amount)) return null;
  let next: StudioCeiling;
  if (c.run === 'along') next = { ...c, edgeRise: (c.edgeRise ?? 0) + amount, ...(c.outline ? { outline: c.outline.map(p => p.roof
    ? { ...p, y: roomHeight(studio) + Math.abs((c.edgeRise ?? 0) + amount) + 1 } : p) } : {}) };
  else {
    const first = c.profile[0]!, span = c.profile.at(-1)!.t - first.t;
    if (span <= 1e-8) return null;
    next = mapBoundary(c, p => p.roof ? p : ({ ...p, y: p.y + amount * (p.t - first.t) / span }), roomHeight(studio));
  }
  return { ...studio, template: 'custom', ceilings: studio.ceilings!.map(item => item.id === id ? next : item) };
}

/** All points translate together when the surface is grabbed; an existing tilt stays intact. */
export function liftWholeCeiling(studio: Studio, id: string, amount: number): Studio | null {
  const c = studio.ceilings?.find(c => c.id === id);
  if (!c || !Number.isFinite(amount)) return null;
  return { ...studio, template: 'custom', ceilings: studio.ceilings!.map(item => item.id === id
    ? mapBoundary(item, p => p.roof ? p : ({ ...p, y: p.y + amount }), roomHeight(studio)) : item) };
}
export function setOuterEdgeHeight(studio: Studio, id: string, height: number) {
  const c = studio.ceilings?.find(c => c.id === id);
  return c ? liftCeilingOuterEdge(studio, id, height - outerEdgeHeight(c)) : null;
}

/** Height on the visible boundary, where a tilted underside meets the room's top. */
export const visibleEdgeHeight = (studio: Studio, c: StudioCeiling, y: number) => Math.min(roomHeight(studio), edgeHeight(c, y));

/** The visible boundary bends where a raised underside meets the room's top. */
export function ceilingEdgeSections(c: StudioCeiling, index: number, top: number) {
  const a = c.profile[index]!, b = c.profile[index + 1]!, dy = b.y - a.y;
  const cross = Math.abs(dy) > 1e-8 ? (top - edgeHeight(c, a.y)) / dy : -1;
  const fractions = cross > 0 && cross < 1 ? [0, cross, 1] : [0, 1];
  return fractions.slice(0, -1).map((from, k) => ({ from, to: fractions[k + 1]! }));
}
