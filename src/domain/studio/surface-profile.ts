/**
 * A wall or a ceiling shape seen from the front or from the side, as one editable profile (profile-polygon.ts).
 * Front: x runs along the wall from its corner a (the room seen from inside: left to right). Side: x runs out from
 * the wall's face (into the room; for a wall's own cross-section, into the wall is negative). y is the height
 * above the floor. A part has a main outline and may have its other side (`section`); the solid is what both
 * allow. The editor changes only profiles; this module reads them from the room and writes them back, so every
 * edit goes through the same rules.
 */
import { lowerBoundary, type BoundaryPoint } from '../geometry/boundary';
import { ensureCounterClockwise, profileProblem, type ProfileBounds, type ProfileProblem, type ProfileVertex } from '../geometry/profile-polygon';
import { STUDIO_LIMITS as L, roomHeight, wallExtent, wallFace, wallLine, type Studio, type StudioCeiling, type StudioWall } from './studio';
import { isWallUtility } from './wall-utilities';
import { withDepth } from './surface-boundary';

export type SurfaceKind = 'wall' | 'ceiling';
export interface SurfaceRef { readonly kind: SurfaceKind; readonly id: string }
/** Which way a part is seen: face on from the room (`front`, x along the wall), or from the side (`side`, x out
 * from the wall's face: into the room for a shape, negative into the wall for the wall's own cross-section). */
export type SurfaceView = 'front' | 'side';
export interface SurfaceProfile {
  readonly ref: SurfaceRef;
  readonly points: ProfileVertex[];
  readonly bounds: ProfileBounds;
  readonly view: SurfaceView;
  /** Whether this view is the part's main outline, or the other side of it (its `section`). */
  readonly primary: boolean;
  readonly wall: StudioWall;
  /** What is drawn around it: the wall's face (or the room's depth) and the room's ceiling. */
  readonly context: { readonly from: number; readonly to: number; readonly top: number };
  /** Where positions are measured from, and what that is called. */
  readonly origin: number;
  readonly fromLabel: string;
  /** Doors and windows on the wall, as rectangles in the same coordinates. */
  readonly openings: readonly { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly kind: string }[];
  /** How far the shape reaches into the room (a ceiling), or the wall's thickness. */
  readonly depth: number;
}

const tidy = (v: number) => Math.round(v * 1e4) / 1e4;
const toVertex = (p: BoundaryPoint & { pinned?: boolean | undefined }): ProfileVertex => p.pinned ? { x: p.t, y: p.y, pinned: true } : { x: p.t, y: p.y };
const toBoundary = (p: ProfileVertex): BoundaryPoint & { pinned?: true } => p.pinned ? { t: tidy(p.x), y: tidy(p.y), pinned: true } : { t: tidy(p.x), y: tidy(p.y) };
const rect = (x0: number, x1: number, y0: number, y1: number): ProfileVertex[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

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

/** A shape whose outer edge is lifted (or lowered), seen from the side: its underside slopes from the wall out. */
function liftedSide(depth: number, low: number, rise: number, top: number): ProfileVertex[] {
  const outer = Math.max(0, Math.min(top, low + rise));
  return top - outer < 5 ? [{ x: 0, y: low }, { x: depth, y: top }, { x: 0, y: top }] : [{ x: 0, y: low }, { x: depth, y: outer }, { x: depth, y: top }, { x: 0, y: top }];
}

/** The view a part opens in: a roof sloping down to its wall from the side, anything else face on. */
export function primaryView(room: Studio, ref: SurfaceRef): SurfaceView {
  return ref.kind === 'ceiling' && room.ceilings?.find(c => c.id === ref.id)?.run === 'across' ? 'side' : 'front';
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

export function surfaceProfile(room: Studio, ref: SurfaceRef, view: SurfaceView = primaryView(room, ref)): SurfaceProfile | null {
  const ceiling = ref.kind === 'ceiling' ? room.ceilings?.find(c => c.id === ref.id) : undefined;
  const w = room.walls.find(x => x.id === (ceiling ? ceiling.wall : ref.id)), line = w && wallLine(room, w), face = w && wallFace(room, w);
  if (!w || !line || !face || (ref.kind === 'ceiling' && !ceiling)) return null;
  const top = roomHeight(room), openings = room.openings.filter(o => o.wall === w.id && !isWallUtility(o.kind))
    .map(o => ({ x0: o.offset - o.width / 2, x1: o.offset + o.width / 2, y0: o.sill, y1: o.sill + o.height, kind: o.kind }));
  const primary = view === primaryView(room, ref), section = (ceiling ?? w).section?.map(toVertex);
  const front = { context: { from: face.start, to: face.end, top }, origin: face.start, fromLabel: 'From the left', openings };
  if (!ceiling) {
    if (!primary) {
      // The wall's cross-section, its room face at 0 and its back at minus its thickness.
      const points = section ?? rect(-w.thickness, 0, 0, w.height);
      return { ref, points: ensureCounterClockwise(points), bounds: { minX: -w.thickness, maxX: 0, minY: 0, maxY: L.maxHeight }, view, primary, wall: w,
        context: { from: -w.thickness, to: 0, top }, origin: -w.thickness, fromLabel: 'From the back', openings: [], depth: w.thickness };
    }
    // Drawn as seen from the room: its inside face, as a tape reads it. The solid's ends run on into the corners.
    const inside = (x: number) => Math.max(face.start, Math.min(face.end, x));
    const points = w.outline ? w.outline.map(p => ({ ...toVertex(p), x: inside(p.t) })) : rect(face.start, face.end, 0, w.height);
    return { ref, points: ensureCounterClockwise(points), bounds: { minX: face.start, maxX: face.end, minY: 0, maxY: L.maxHeight }, view, primary, wall: w,
      ...front, depth: w.thickness };
  }
  const main = ensureCounterClockwise(ceilingPoints(ceiling, top)), low = Math.min(...main.map(p => p.y));
  const reach = Math.max(L.minCeilingDepth, reachOf(room, w), ...(ceiling.run === 'across' ? main : section ?? []).map(p => p.x));
  const side = { bounds: { minX: 0, maxX: reach, minY: 0, maxY: top }, context: { from: 0, to: reach, top }, origin: 0, fromLabel: 'From the wall', openings: [] };
  if (view === 'front') {
    // A shape along its wall, or the front of a roof: plain, it covers the whole wall's face.
    const points = primary ? main : ensureCounterClockwise(section ?? rect(face.start, face.end, low, top));
    return { ref, points, bounds: { minX: face.start, maxX: face.end, minY: 0, maxY: top }, view, primary, wall: w, ...front, depth: ceiling.depth };
  }
  // A roof sloping to its wall, or the side of a shape along a wall: plain, it reaches straight out to its depth.
  const points = primary ? main : ensureCounterClockwise(section ?? (ceiling.edgeRise ? liftedSide(ceiling.depth, low, ceiling.edgeRise, top) : rect(0, ceiling.depth, low, top)));
  return { ref, points, view, primary, wall: w, ...side, depth: ceiling.run === 'across' ? face.length : ceiling.depth };
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
  if (!part) return [];
  const main = primaryView(room, ref), other: SurfaceView = main === 'front' ? 'side' : 'front';
  return ([[main, part.outline], [other, part.section]] as const).flatMap(([view, outline]) => {
    const s = outline && surfaceProfile(room, ref, view), problem = s && profileProblem(s.points, s.bounds);
    return problem ? [profileMessage(problem)] : [];
  });
}

/** Writes a profile back. A wall keeps its height at its highest point; a ceiling's underside, which wardrobes
 * fit under, is the profile's lowest edge. Null when the profile breaks a rule. */
export function withSurfaceProfile(room: Studio, ref: SurfaceRef, points: readonly ProfileVertex[], view: SurfaceView = primaryView(room, ref)): Studio | null {
  const s = surfaceProfile(room, ref, view);
  if (!s || profileProblem(points, s.bounds)) return null;
  if (!s.primary) return withSection(room, s, points);
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

/** The other side of a part. Plain (the rectangle it opens as), it is not kept; a shape along a wall reaches as
 * far into the room as its side outline does. */
function withSection(room: Studio, s: SurfaceProfile, points: readonly ProfileVertex[]): Studio {
  const box = { x0: Math.min(...points.map(p => p.x)), x1: Math.max(...points.map(p => p.x)), y0: Math.min(...points.map(p => p.y)), y1: Math.max(...points.map(p => p.y)) };
  const isRect = points.length === 4 && points.every(p => !p.pinned && (Math.abs(p.x - box.x0) < 1e-6 || Math.abs(p.x - box.x1) < 1e-6) && (Math.abs(p.y - box.y0) < 1e-6 || Math.abs(p.y - box.y1) < 1e-6));
  const section = points.map(toBoundary);
  if (s.ref.kind === 'wall') {
    const w = s.wall, plain = isRect && Math.abs(box.x0 + w.thickness) < 1e-6 && Math.abs(box.x1) < 1e-6 && box.y0 < 1e-6 && box.y1 >= w.height - 1e-6;
    return { ...room, template: 'custom', walls: room.walls.map(x => {
      if (x.id !== w.id) return x;
      const { section: _s, ...rest } = x;
      return plain ? rest : { ...rest, section };
    }) };
  }
  return { ...room, template: 'custom', ceilings: room.ceilings!.map(c => {
    if (c.id !== s.ref.id) return c;
    const { section: _s, ...rest } = c.edgeRise ? withoutLift(c, s.context.top) : c, low = Math.min(...ceilingPoints(c, s.context.top).map(p => p.y));
    const across = c.run === 'along';
    // Plain when it covers the whole front (or reaches straight out from the wall) and the part's full height.
    const full = across ? Math.abs(box.x0) < 1e-6 : Math.abs(box.x0 - s.bounds.minX) < 1e-6 && Math.abs(box.x1 - s.bounds.maxX) < 1e-6;
    const plain = isRect && full && box.y0 <= low + 1e-6 && box.y1 >= s.context.top - 1e-6;
    const depth = across ? tidy(box.x1) : c.depth;
    return plain ? { ...rest, depth } : { ...rest, depth, section };
  }) };
}

/** A lifted shape drawn from the side takes its lift into its side outline: the lift goes, and a lowered outer edge
 * lowers its front outline, which is the shape's outline seen from the front. */
function withoutLift(c: StudioCeiling, top: number): StudioCeiling {
  const { edgeRise: rise = 0, ...rest } = c, drop = Math.min(0, rise);
  const outline = ceilingPoints(c, top).map(p => p.y >= top - 1e-6 ? { t: p.x, y: top, roof: true as const } : { t: p.x, y: tidy(Math.max(0, p.y + drop)) });
  return { ...rest, outline, profile: lowerBoundary(outline).map(p => ({ t: p.t, y: Math.min(top, p.y) })) };
}

/** How far a ceiling shape reaches into the room: its side outline, if it has one, stretches to it. */
export function setSurfaceDepth(room: Studio, ref: SurfaceRef, depth: number): Studio | null {
  if (ref.kind !== 'ceiling' || !Number.isFinite(depth) || depth < L.minCeilingDepth || depth > L.maxWallLength) return null;
  const c = room.ceilings?.find(x => x.id === ref.id);
  const next = c && c.run === 'along' ? withDepth(c, depth) : null;
  return next && { ...room, template: 'custom', ceilings: room.ceilings!.map(x => x === c ? next : x) };
}
