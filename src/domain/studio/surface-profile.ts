/**
 * A wall or a ceiling shape seen face on, as one editable profile (profile-polygon.ts). x runs along the wall
 * from its corner a (the room seen from inside: left to right), or, for a roof sloping down to the wall, out from
 * the wall's face. y is the height above the floor. The editor changes only the profile; this module reads it
 * from the room and writes it back, so every edit goes through the same rules.
 */
import { lowerBoundary, type BoundaryPoint } from '../geometry/boundary';
import { ensureCounterClockwise, profileProblem, type ProfileBounds, type ProfileProblem, type ProfileVertex } from '../geometry/profile-polygon';
import { STUDIO_LIMITS as L, roomHeight, wallExtent, wallFace, wallLine, type Studio, type StudioCeiling, type StudioWall } from './studio';
import { isWallUtility } from './wall-utilities';

export type SurfaceKind = 'wall' | 'ceiling';
export interface SurfaceRef { readonly kind: SurfaceKind; readonly id: string }
export interface SurfaceProfile {
  readonly ref: SurfaceRef;
  readonly points: ProfileVertex[];
  readonly bounds: ProfileBounds;
  /** Face on along the wall, or the room in section for a roof sloping down to the wall. */
  readonly view: 'front' | 'side';
  readonly wall: StudioWall;
  /** What is drawn around it: the wall's face (or the room's depth) and the room's ceiling. */
  readonly context: { readonly from: number; readonly to: number; readonly top: number };
  /** Where positions are measured from: the wall's inside end at its corner a, or the wall's face. */
  readonly origin: number;
  /** Doors and windows on the wall, as rectangles in the same coordinates. */
  readonly openings: readonly { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly kind: string }[];
  /** How far the shape reaches into the room (a ceiling), or the wall's thickness. */
  readonly depth: number;
}

const tidy = (v: number) => Math.round(v * 1e4) / 1e4;
const toVertex = (p: BoundaryPoint & { pinned?: boolean | undefined }): ProfileVertex => p.pinned ? { x: p.t, y: p.y, pinned: true } : { x: p.t, y: p.y };
const toBoundary = (p: ProfileVertex): BoundaryPoint & { pinned?: true } => p.pinned ? { t: tidy(p.x), y: tidy(p.y), pinned: true } : { t: tidy(p.x), y: tidy(p.y) };

/** Where a ceiling's top corners sit: at the room's ceiling, or above it on a ceiling whose outer edge is
 * lifted or lowered, so the tilted solid still meets the ceiling everywhere (see ceiling-edge.ts). */
const capOf = (c: StudioCeiling, top: number) => c.edgeRise ? top + Math.abs(c.edgeRise) + 1 : top;

/** A ceiling's outline as drawn: its top corners on the room's ceiling. One saved before shapes had outlines is its
 * underside, closed along the room's ceiling. */
function ceilingPoints(c: StudioCeiling, top: number): ProfileVertex[] {
  if (c.outline) return c.outline.map(p => toVertex(p.roof || p.y > top ? { ...p, y: top } : p));
  const first = c.profile[0]!, last = c.profile.at(-1)!;
  const list: ProfileVertex[] = c.profile.map(p => ({ x: p.t, y: Math.min(top, p.y) }));
  if (Math.abs(last.y - top) > 1e-6) list.push({ x: last.t, y: top });
  if (Math.abs(first.y - top) > 1e-6) list.push({ x: first.t, y: top });
  return list;
}

function reachOf(room: Studio, w: StudioWall): number {
  const line = wallLine(room, w), face = wallFace(room, w);
  if (!line || !face) return L.maxWallLength;
  // The room in front of the middle of the wall: to the nearest wall face straight ahead.
  const mid = (face.start + face.end) / 2, o = { x: line.a.x + line.ux * mid + line.nx * w.thickness / 2, z: line.a.z + line.uz * mid + line.nz * w.thickness / 2 };
  let best: number = L.maxWallLength;
  for (const other of room.walls) {
    const ol = other === w ? null : wallLine(room, other);
    if (!ol) continue;
    const det = line.nx * -ol.uz + line.nz * ol.ux;
    if (Math.abs(det) < 1e-6) continue;
    const qx = ol.a.x - o.x, qz = ol.a.z - o.z, r = (qx * -ol.uz + qz * ol.ux) / det, q = (line.nx * qz - line.nz * qx) / det;
    if (r > 1 && q >= -1 && q <= ol.length + 1) best = Math.min(best, r - other.thickness / 2);
  }
  return best;
}

export function surfaceProfile(room: Studio, ref: SurfaceRef): SurfaceProfile | null {
  const ceiling = ref.kind === 'ceiling' ? room.ceilings?.find(c => c.id === ref.id) : undefined;
  const w = room.walls.find(x => x.id === (ceiling ? ceiling.wall : ref.id)), line = w && wallLine(room, w), face = w && wallFace(room, w);
  if (!w || !line || !face || (ref.kind === 'ceiling' && !ceiling)) return null;
  const top = roomHeight(room), openings = room.openings.filter(o => o.wall === w.id && !isWallUtility(o.kind))
    .map(o => ({ x0: o.offset - o.width / 2, x1: o.offset + o.width / 2, y0: o.sill, y1: o.sill + o.height, kind: o.kind }));
  if (!ceiling) {
    // Drawn as seen from the room: its inside face, as a tape reads it. The solid's ends run on into the corners.
    const inside = (x: number) => Math.max(face.start, Math.min(face.end, x));
    const points = w.outline ? w.outline.map(p => ({ ...toVertex(p), x: inside(p.t) }))
      : [{ x: face.start, y: 0 }, { x: face.end, y: 0 }, { x: face.end, y: w.height }, { x: face.start, y: w.height }];
    return { ref, points: ensureCounterClockwise(points), bounds: { minX: face.start, maxX: face.end, minY: 0, maxY: L.maxHeight }, view: 'front', wall: w,
      context: { from: face.start, to: face.end, top }, origin: face.start, openings, depth: w.thickness };
  }
  const points = ensureCounterClockwise(ceilingPoints(ceiling, top));
  if (ceiling.run === 'along') return { ref, points, bounds: { minX: face.start, maxX: face.end, minY: 0, maxY: top }, view: 'front', wall: w,
    context: { from: face.start, to: face.end, top }, origin: face.start, openings, depth: ceiling.depth };
  const reach = Math.max(L.minCeilingDepth, reachOf(room, w), ...points.map(p => p.x));
  return { ref, points, bounds: { minX: 0, maxX: reach, minY: 0, maxY: top }, view: 'side', wall: w,
    context: { from: 0, to: reach, top }, origin: 0, openings: [], depth: face.length };
}

const PROBLEMS: Record<ProfileProblem, string> = {
  'too-few-points': 'A shape needs at least three corners.',
  'out-of-bounds': 'Keep the shape on its wall, between the floor and the ceiling.',
  'winding-or-area': 'This shape has no area left. Pull it out again.',
  'short-edge': 'Keep every edge at least 5 cm long, or remove a corner.',
  'self-intersection': 'Edges cannot cross. Move the corner back.',
  'neck-clearance': 'This part would be thinner than 5 cm. Move the corner back.',
};
export const profileMessage = (problem: ProfileProblem) => PROBLEMS[problem];

/** Why a shaped wall or ceiling cannot be built, worded as what to do. Empty when it is fine or unshaped. */
export function surfaceProblems(room: Studio, ref: SurfaceRef): string[] {
  const part = ref.kind === 'wall' ? room.walls.find(w => w.id === ref.id) : room.ceilings?.find(c => c.id === ref.id);
  if (!part?.outline) return [];
  const s = surfaceProfile(room, ref);
  if (!s) return [];
  const problem = profileProblem(s.points, s.bounds);
  return problem ? [profileMessage(problem)] : [];
}

/** Writes a profile back. A wall keeps its height at its highest point; a ceiling's underside, which wardrobes
 * fit under, is the profile's lowest edge. Null when the profile breaks a rule. */
export function withSurfaceProfile(room: Studio, ref: SurfaceRef, points: readonly ProfileVertex[]): Studio | null {
  const s = surfaceProfile(room, ref);
  if (!s || profileProblem(points, s.bounds)) return null;
  const outline = points.map(toBoundary);
  if (ref.kind === 'wall') {
    const height = tidy(Math.max(...points.map(p => p.y))), line = wallLine(room, s.wall)!, ext = wallExtent(room, s.wall, line.length);
    if (height < L.minHeight - 1e-6) return null;
    // Corners at the inside face's ends are the solid's ends, in the corners where walls meet.
    const solid = outline.map(p => Math.abs(p.t - s.bounds.minX) < 1e-6 ? { ...p, t: ext.start } : Math.abs(p.t - s.bounds.maxX) < 1e-6 ? { ...p, t: ext.end } : p);
    return { ...room, template: 'custom', walls: room.walls.map(w => {
      if (w.id !== ref.id) return w;
      const { outline: _o, boundaryControls: _c, ...rest } = w;
      // A full-height rectangle over the whole wall is an ordinary wall again.
      const plain = points.length === 4 && points.every(p => !p.pinned)
        && points.every(p => (Math.abs(p.x - s.bounds.minX) < 1e-6 || Math.abs(p.x - s.bounds.maxX) < 1e-6) && (Math.abs(p.y) < 1e-6 || Math.abs(p.y - height) < 1e-6));
      return plain ? { ...rest, height } : { ...rest, height, outline: solid };
    }) };
  }
  const top = roomHeight(room), profile = lowerBoundary(outline).map(p => ({ t: p.t, y: Math.min(top, p.y) }));
  if (profile.length < 2) return null;
  return { ...room, template: 'custom', ceilings: room.ceilings!.map(c => {
    if (c.id !== ref.id) return c;
    const { boundaryControls: _c, ...rest } = c, cap = capOf(c, top);
    // Corners on the room's ceiling are its top: raised to the cap and marked, so a later edge lift moves them.
    const shaped = outline.map(p => p.y >= top - 1e-6 ? { ...p, y: cap, roof: true } : p);
    return { ...rest, outline: shaped, profile, depth: c.run === 'across' ? profile.at(-1)!.t : c.depth };
  }) };
}

/** How far a ceiling shape reaches into the room. */
export function setSurfaceDepth(room: Studio, ref: SurfaceRef, depth: number): Studio | null {
  if (ref.kind !== 'ceiling' || !Number.isFinite(depth) || depth < L.minCeilingDepth || depth > L.maxWallLength) return null;
  const c = room.ceilings?.find(x => x.id === ref.id);
  if (!c || c.run !== 'along') return null;
  return { ...room, template: 'custom', ceilings: room.ceilings!.map(x => x === c ? { ...c, depth: tidy(depth) } : x) };
}
