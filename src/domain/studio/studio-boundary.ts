import { boundaryPoint, lowerBoundary, validBoundary, type BoundaryLocation } from '../geometry/boundary';
import { roomHeight, wallExtent, wallLine, type CeilingPoint, type Studio, type StudioCeiling, type StudioCorner, type StudioWall } from './studio';

export function wallBoundary(room: Studio, wall: StudioWall): readonly CeilingPoint[] {
  if (wall.outline) return wall.outline;
  const line = wallLine(room, wall);
  if (!line) return [];
  const { start, end } = wallExtent(room, wall, line.length);
  return [{ t: start, y: 0 }, { t: end, y: 0 }, { t: end, y: wall.height }, { t: start, y: wall.height }];
}
export function ceilingBoundary(room: Studio, ceiling: StudioCeiling): readonly CeilingPoint[] {
  if (ceiling.outline) return ceiling.outline;
  const points = [...ceiling.profile], first = points[0], last = points.at(-1), top = roomHeight(room);
  if (!first || !last) return [];
  if (last.y !== top) points.push({ t: last.t, y: top });
  if (first.y !== top) points.push({ t: first.t, y: top });
  return points;
}
export type BoundarySurface = 'wall' | 'ceiling';
/** Only profile points are controls; closing a solid must not invent editable corner dots. */
export function controlledBoundary(room: Studio, kind: BoundarySurface, id: string): readonly CeilingPoint[] {
  const part = kind === 'wall' ? room.walls.find(w => w.id === id) : room.ceilings?.find(c => c.id === id);
  const points = surfaceBoundary(room, kind, id);
  if (!part || part.outline) return points;
  const count = kind === 'wall' ? 0 : room.ceilings!.find(c => c.id === id)!.profile.length;
  return points.map((p, k) => k < count ? p : { ...p, control: -1 });
}
export function stretchWallBoundaries(room: Studio, corners: readonly StudioCorner[]) {
  return room.walls.map(w => {
    if (!w.outline) return w;
    const old = wallLine(room, w), nextRoom = { ...room, corners }, next = wallLine(nextRoom, w);
    if (!old || !next) return w;
    const from = wallExtent(room, w, old.length), to = wallExtent(nextRoom, w, next.length), span = from.end - from.start;
    const map = (p: CeilingPoint) => ({ ...p, t: to.start + (p.t - from.start) * (to.end - to.start) / span });
    return { ...w, outline: w.outline.map(map), ...(w.sections ? { sections: w.sections.map(s => ({ ...s, outline: s.outline.map(map) })) } : {}) };
  });
}
export function surfaceBoundary(room: Studio, kind: BoundarySurface, id: string) {
  if (kind === 'wall') { const w = room.walls.find(w => w.id === id); return w ? wallBoundary(room, w) : []; }
  const c = room.ceilings?.find(c => c.id === id);
  return c ? ceilingBoundary(room, c) : [];
}
function replace(room: Studio, kind: BoundarySurface, id: string, outline: readonly CeilingPoint[]): Studio | null {
  if (!validBoundary(outline)) return null;
  if (kind === 'wall') return { ...room, template: 'custom', walls: room.walls.map(w => w.id === id ? { ...w, outline } : w) };
  const profile = lowerBoundary(outline);
  return { ...room, template: 'custom', ceilings: room.ceilings?.map(c => c.id === id
    ? { ...c, outline, profile, depth: c.run === 'across' ? profile.at(-1)!.t : c.depth } : c) };
}
/** Inserting at an existing corner is a no-op; nearby points keep their full precision. */
export function splitSurfaceBoundary(room: Studio, kind: BoundarySurface, id: string, at: BoundaryLocation): Studio | null {
  const points = controlledBoundary(room, kind, id), p = boundaryPoint(points, at);
  if (!p || !Number.isFinite(at.fraction) || at.fraction <= 0 || at.fraction >= 1) return null;
  return replace(room, kind, id, [...points.slice(0, at.edge + 1), { ...p, control: at.section === 0 ? 0 : 1 }, ...points.slice(at.edge + 1)]);
}
export function moveSurfaceBoundaryPoint(room: Studio, kind: BoundarySurface, id: string, index: number, point: CeilingPoint): Studio | null {
  const points = surfaceBoundary(room, kind, id);
  if (!points[index]) return null;
  return replace(room, kind, id, points.map((p, k) => k === index ? { ...p, ...point } : p));
}
