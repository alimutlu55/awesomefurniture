import { lowerBoundary, validBoundary, type BoundaryPoint } from '../geometry/boundary';
import { roomHeight, wallExtent, wallFace, wallLine, type BoundaryControl, type Studio, type StudioCeiling } from './studio';

export type SurfaceKind = 'wall' | 'ceiling';
export type BoundaryVertex = BoundaryPoint & { u: number; v: number };
export interface SurfaceEdge {
  readonly key: string; readonly kind: 'rim' | 'return' | 'cap'; readonly index: number;
  readonly a: BoundaryVertex; readonly b: BoundaryVertex;
}
export interface SurfaceLocation { readonly edge: string; readonly fraction: number }
const mix = (a: BoundaryVertex, b: BoundaryVertex, f: number): BoundaryVertex => ({
  t: a.t + (b.t - a.t) * f, y: a.y + (b.y - a.y) * f, u: a.u + (b.u - a.u) * f, v: a.v + (b.v - a.v) * f,
});
const near = (a: BoundaryPoint, b: BoundaryPoint) => Math.hypot(a.t - b.t, a.y - b.y) < 1e-7;
export function surfaceBoundary(room: Studio, kind: SurfaceKind, id: string) {
  const ceiling = kind === 'ceiling' ? room.ceilings?.find(c => c.id === id) : undefined;
  const w = room.walls.find(w => w.id === (ceiling?.wall ?? id)), line = w && wallLine(room, w), face = w && wallFace(room, w);
  if (!w || !line || !face || kind === 'ceiling' && !ceiling) return null;
  const part = ceiling ?? w, top = roomHeight(room), ext = wallExtent(room, w, line.length);
  let points: readonly BoundaryPoint[];
  if (part.outline) points = part.outline;
  else if (ceiling) {
    const ps: BoundaryPoint[] = [...ceiling.profile], first = ps[0]!, last = ps.at(-1)!;
    const cap = ceiling.edgeRise ? top + Math.abs(ceiling.edgeRise) + 1 : top;
    if (last.y !== cap) ps.push({ t: last.t, y: cap, roof: true });
    if (first.y !== cap) ps.push({ t: first.t, y: cap, roof: true });
    points = ps;
  } else points = [{ t: ext.start, y: 0 }, { t: ext.end, y: 0 }, { t: ext.end, y: w.height }, { t: ext.start, y: w.height }];
  let controls: readonly BoundaryControl[] = part.boundaryControls ?? (ceiling ? ceiling.profile.map((_, index) => ({ index, u: 1 })) : []);
  const world = (p: BoundaryPoint & { u: number }) => {
    let along = p.t, depth = (p.u - .5) * w.thickness, y = p.y;
    if (ceiling) {
      along = ceiling.run === 'along' ? p.t : face.start + (face.end - face.start) * p.u;
      depth = w.thickness / 2 + (ceiling.run === 'along' ? p.u * ceiling.depth : p.t);
      y += ceiling.run === 'along' ? (ceiling.edgeRise ?? 0) * p.u : 0;
    }
    return { x: line.a.x + line.ux * along + line.nx * depth, y, z: line.a.z + line.uz * along + line.nz * depth };
  };
  if (!part.boundaryControls && ceiling) controls = controls.filter(c => world({ ...points[c.index]!, u: c.u }).y <= top + 1e-8);
  const edges: SurfaceEdge[] = [], seen = new Set<string>();
  const add = (a: BoundaryVertex, b: BoundaryVertex, index: number, capKey?: string) => {
    const pa = world(a), pb = world(b);
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z) < 1e-7) return;
    const stamp = (p: typeof pa) => [p.x, p.y, p.z].map(n => Math.round(n * 1e6)).join(',');
    const signature = [stamp(pa), stamp(pb)].sort().join('/');
    if (seen.has(signature)) return;
    seen.add(signature);
    const rim = Math.abs(a.u - b.u) < 1e-8, returned = Math.abs(a.v - b.v) < 1e-8;
    const vertex = a.v < .5 ? index : (index + 1) % points.length;
    const key = capKey ?? (rim ? 'rim:' + Math.round(a.u) + ':' + index : returned ? 'return:' + vertex : 'cap:' + index);
    edges.push({ key, kind: capKey ? 'cap' : rim ? 'rim' : returned ? 'return' : 'cap', index, a, b });
  };
  // Each quad is a real boundary face of the extrusion. Clip it to the room top
  // before extracting edges, so tilted ceilings expose their actual intersections.
  for (let index = 0; index < points.length; index++) {
    const a = points[index]!, b = points[(index + 1) % points.length]!;
    const quad = [{ ...a, u: 1, v: 0 }, { ...b, u: 1, v: 1 }, { ...b, u: 0, v: 1 }, { ...a, u: 0, v: 0 }];
    const clipped: BoundaryVertex[] = [];
    for (let k = 0; k < quad.length; k++) {
      const p = quad[k]!, q = quad[(k + 1) % quad.length]!, py = world(p).y, qy = world(q).y;
      const inside = !ceiling || py <= top + 1e-8, other = !ceiling || qy <= top + 1e-8;
      if (inside) clipped.push(p);
      if (inside !== other) clipped.push(mix(p, q, (top - py) / (qy - py)));
    }
    for (let k = 0; k < clipped.length; k++) add(clipped[k]!, clipped[(k + 1) % clipped.length]!, index);
  }
  if (ceiling) for (const u of [0, 1]) {
    const clipped: BoundaryVertex[] = [];
    points.forEach((p, index) => {
      const a = { ...p, u, v: 0 }, b = { ...points[(index + 1) % points.length]!, u, v: 1 };
      const ay = world(a).y, by = world(b).y;
      if (ay <= top + 1e-8) clipped.push(a);
      if ((ay <= top) !== (by <= top)) clipped.push(mix(a, b, (top - ay) / (by - ay)));
    });
    clipped.forEach((a, k) => {
      const b = clipped[(k + 1) % clipped.length]!;
      if (Math.abs(world(a).y - top) > 1e-7 || Math.abs(world(b).y - top) > 1e-7 || Math.abs(b.t - a.t) < 1e-8) return;
      const t = (a.t + b.t) / 2;
      const upper = points.map((p, index) => {
        const q = points[(index + 1) % points.length]!, f = (t - p.t) / (q.t - p.t);
        return { index, f, y: p.y + (q.y - p.y) * f };
      }).filter(e => e.f >= 0 && e.f <= 1).sort((p, q) => q.y - p.y)[0];
      if (upper) add(a, b, upper.index, 'caprim:' + u + ':' + upper.index + ':' + k);
    });
  }
  return { part, ceiling, wall: w, line, face, points, controls, edges, world };
}
export const edgePoint = (edge: SurfaceEdge, fraction: number) => mix(edge.a, edge.b, Math.max(0, Math.min(1, fraction)));

function replace(room: Studio, kind: SurfaceKind, id: string, outline: readonly BoundaryPoint[], controls: readonly BoundaryControl[]): Studio | null {
  if (!validBoundary(outline)) return null;
  if (kind === 'wall') return { ...room, template: 'custom', walls: room.walls.map(w => w.id === id ? { ...w, outline, boundaryControls: controls } : w) };
  const profile = lowerBoundary(outline).map(p => ({ ...p, y: Math.min(roomHeight(room), p.y) }));
  if (profile.length < 2) return null;
  return { ...room, template: 'custom', ceilings: room.ceilings?.map(c => c.id === id
    ? { ...c, outline, boundaryControls: controls, profile, depth: c.run === 'across' ? profile.at(-1)!.t : c.depth } : c) };
}
/** A cut adds exactly the requested control. The matched edge on the other face
 * follows the same profile so walls retain their thickness and faces stay planar. */
export function splitSurfaceBoundary(room: Studio, kind: SurfaceKind, id: string, at: SurfaceLocation): Studio | null {
  const surface = surfaceBoundary(room, kind, id), edge = surface?.edges.find(e => e.key === at.edge);
  if (!surface || !edge || !Number.isFinite(at.fraction) || at.fraction <= 1e-8 || at.fraction >= 1 - 1e-8) return null;
  let point = edgePoint(edge, at.fraction);
  const outline = [...surface.points];
  if (edge.key.startsWith('caprim:')) {
    const a = outline[edge.index]!, b = outline[(edge.index + 1) % outline.length]!;
    const y = a.y + (b.y - a.y) * (point.t - a.t) / (b.t - a.t);
    point = { ...point, y, roof: true };
  }
  const existing = outline.findIndex(p => near(p, point));
  if (existing >= 0) {
    if (surface.controls.some(c => c.index === existing && Math.abs(c.u - point.u) < 1e-7)) return null;
    return replace(room, kind, id, outline, [...surface.controls, { index: existing, u: point.u }]);
  }
  const index = edge.index + 1;
  outline.splice(index, 0, { t: point.t, y: point.y, ...(point.roof ? { roof: true } : {}) });
  const controls = surface.controls.map(c => ({ ...c, index: c.index >= index ? c.index + 1 : c.index }));
  return replace(room, kind, id, outline, [...controls, { index, u: point.u }]);
}
export function moveSurfaceControl(room: Studio, kind: SurfaceKind, id: string, control: number, point: BoundaryPoint): Studio | null {
  const surface = surfaceBoundary(room, kind, id), c = surface?.controls[control];
  if (!surface || !c || !Number.isFinite(point.t) || !Number.isFinite(point.y)) return null;
  return replace(room, kind, id, surface.points.map((p, k) => k === c.index ? { t: point.t, y: point.y } : p), surface.controls);
}
export function boundaryProblems(room: Studio, kind: SurfaceKind, id: string): string[] {
  const s = surfaceBoundary(room, kind, id);
  if (!s || !s.part.outline) return [];
  if (!validBoundary(s.points)) return ['This edge would fold over another edge. Move the point back.'];
  if (s.controls.some(c => !Number.isInteger(c.index) || !s.points[c.index] || !Number.isFinite(c.u) || c.u < 0 || c.u > 1)) return ['Choose a point on the surface boundary.'];
  const minY = kind === 'wall' ? 0 : 40, maxY = kind === 'wall' ? s.wall.height : roomHeight(room);
  if ((kind === 'wall' ? s.points : s.controls.map(c => ({ ...s.points[c.index]!, y: Math.min(roomHeight(room), s.world({ ...s.points[c.index]!, u: c.u }).y) })))
    .some(p => !p || p.y < minY - .01 || p.y > maxY + .01)) return ['Keep the shape between the floor and the top of its surface.'];
  const ext = wallExtent(room, s.wall, s.line.length), min = s.ceiling?.run === 'across' ? 0 : kind === 'wall' ? ext.start : s.face.start;
  const max = s.ceiling?.run === 'across' ? 2000 : kind === 'wall' ? ext.end : s.face.end;
  if (s.points.some(p => p.t < min - .01 || p.t > max + .01)) return ['Keep the shape on its supporting wall. Resize the wall to extend it.'];

  return [];
}

/** Update legacy shape controls without discarding cuts on other edges. */
export function withCeilingProfile(c: StudioCeiling, profile: StudioCeiling['profile']): StudioCeiling {
  if (!c.outline) return { ...c, profile };
  const outline = c.outline.map(p => {
    if (p.roof) return p;
    const index = c.profile.findIndex(old => near(old, p));
    return index >= 0 ? profile[index] ?? p : p;
  });
  return { ...c, outline, profile: lowerBoundary(outline) };
}
const lowerCache = new WeakMap<readonly BoundaryPoint[], readonly BoundaryPoint[]>();
const lowerOf = (outline: readonly BoundaryPoint[]) => {
  let profile = lowerCache.get(outline);
  if (!profile) { profile = lowerBoundary(outline); lowerCache.set(outline, profile); }
  return profile;
};
export function ceilingLowerProfile(c: StudioCeiling) {
  return c.outline ? lowerOf(c.outline) : c.profile;
}
/** The underside seen from the other side (see `section`), or null when that side is plain. */
export const sectionLowerProfile = (c: StudioCeiling) => c.section ? lowerOf(c.section) : null;
/** How far the other side's outline reaches across, or null when it is plain. */
export function sectionExtent(c: { readonly section?: readonly BoundaryPoint[] | undefined }) {
  if (!c.section?.length) return null;
  const ts = c.section.map(p => p.t);
  return { from: Math.min(...ts), to: Math.max(...ts) };
}

export function boundaryControlHeight(room: Studio, kind: SurfaceKind, id: string, index: number): number | null {
  const s = surfaceBoundary(room, kind, id), control = s?.controls[index], p = control && s!.points[control.index];
  return p ? Math.min(kind === 'ceiling' ? roomHeight(room) : Infinity, s!.world({ ...p, u: control!.u }).y) : null;
}
export function setBoundaryControlHeight(room: Studio, kind: SurfaceKind, id: string, index: number, height: number): Studio | null {
  const s = surfaceBoundary(room, kind, id), control = s?.controls[index], p = control && s!.points[control.index];
  const current = boundaryControlHeight(room, kind, id, index);
  return p && current !== null ? moveSurfaceControl(room, kind, id, index, { ...p, y: p.y + height - s!.world({ ...p, u: control!.u }).y }) : null;
}

/** A shape along a wall made `depth` deep: its side outline, if it has one, stretches to it from where it starts.
 * Null when the side outline starts beyond that depth. */
export function withDepth(c: StudioCeiling, depth: number): StudioCeiling | null {
  const round = (v: number) => Math.round(v * 10) / 10, side = sectionExtent(c);
  if (!side || side.to - side.from < 1e-6) return { ...c, depth: round(depth) };
  if (depth <= side.from) return null;
  return { ...c, depth: round(depth), section: c.section!.map(p => ({ ...p, t: round(side.from + (p.t - side.from) * (depth - side.from) / (side.to - side.from)) })) };
}
