import { clipBoundary, lowerBoundary, type BoundaryPoint } from '../geometry/boundary';
import { wallExtent, wallLine, type Studio, type StudioCeiling, type StudioWall, type SurfaceBoundary } from './studio';

/** Keep user controls attached to their surviving polygon vertices when a wall is divided. */
function trimmed(part: SurfaceBoundary, from: number, to: number, offset: number) {
  if (!part.outline) return {};
  const old = part.outline, clipped = clipBoundary(old, from, to);
  const boundaryControls = (part.boundaryControls ?? []).flatMap(c => {
    const p = old[c.index];
    const index = p ? clipped.findIndex(q => Math.hypot(q.t - p.t, q.y - p.y) < 1e-7) : -1;
    return index < 0 ? [] : [{ ...c, index }];
  });
  return { outline: clipped.map(p => ({ ...p, t: p.t - offset })), boundaryControls };
}
export function trimBoundary(c: StudioCeiling, from: number, to: number, offset: number, top: number): StudioCeiling {
  const next = { ...c, ...trimmed(c, from, to, offset) };
  return next.outline ? { ...next, profile: lowerBoundary(next.outline).map(p => ({ ...p, y: Math.min(top, p.y) })) } : next;
}
export function trimWallBoundary(w: StudioWall, from: number, to: number, offset: number): StudioWall {
  return { ...w, ...trimmed(w, from, to, offset) };
}
export function mapBoundary(c: StudioCeiling, map: (p: BoundaryPoint) => BoundaryPoint, top: number, reverse = false): StudioCeiling {
  if (!c.outline) return { ...c, profile: (reverse ? [...c.profile].reverse() : c.profile).map(map) };
  const outline = c.outline.map(map);
  return { ...c, outline, profile: lowerBoundary(outline).map(p => ({ ...p, y: Math.min(top, p.y) })) };
}
/** Changing the supporting run stretches the complete wall face, including existing cuts. */
export function keepWallBoundaries(before: Studio, after: Studio): readonly StudioWall[] {
  return after.walls.map(w => {
    const old = before.walls.find(p => p.id === w.id), a = old && wallLine(before, old), b = wallLine(after, w);
    if (!old?.outline || !a || !b) return w;
    const from = wallExtent(before, old, a.length), to = wallExtent(after, w, b.length);
    const span = from.end - from.start;
    return { ...w, outline: old.outline.map(p => ({ ...p, t: to.start + (p.t - from.start) * (to.end - to.start) / span })) };
  });
}
