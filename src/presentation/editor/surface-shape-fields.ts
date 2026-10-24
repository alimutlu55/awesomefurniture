import { edgeAngle, movePoint, profileExtent, setEdgeAngle, setEdgeLength, setExtent, slideEdge, translateProfile, type ProfileVertex } from '../../domain/geometry/profile-polygon';
import type { SurfaceProfile } from '../../domain/studio/surface-profile';
import type { ShapePick } from './surface-shape-drawing';

/** The exact sizes the Shape editor offers for what is picked: a corner's place, an edge's length and level,
 * or, with nothing picked, the whole shape's size and place. Values are centimetres. */
export interface ShapeField { readonly key: string; readonly label: string; readonly value: number; readonly hint?: string; readonly unit?: string }

const level = (a: ProfileVertex, b: ProfileVertex) => Math.abs(a.y - b.y) < 1e-6 ? 'level' : Math.abs(a.x - b.x) < 1e-6 ? 'upright' : null;
const fromLabel = (s: SurfaceProfile) => s.view === 'side' ? 'From the wall' : 'From the left';

/** `outer` is a ceiling's outer edge height, when it has one to lift (the side away from the wall). */
export function shapeFields(s: SurfaceProfile, points: readonly ProfileVertex[], pick: ShapePick, outer?: number): ShapeField[] {
  if (pick?.kind === 'vertex' && points[pick.index]) {
    const p = points[pick.index]!;
    return [{ key: 'x', label: fromLabel(s), value: p.x - s.origin }, { key: 'y', label: 'Height', value: p.y }];
  }
  if (pick?.kind === 'edge' && points[pick.index]) {
    const a = points[pick.index]!, b = points[(pick.index + 1) % points.length]!, kind = level(a, b);
    const list: ShapeField[] = [{ key: 'length', label: 'Length', value: Math.hypot(b.x - a.x, b.y - a.y) }];
    if (kind === 'level') list.push({ key: 'level', label: 'Height', value: a.y });
    if (kind === 'upright') list.push({ key: 'position', label: fromLabel(s), value: a.x - s.origin });
    if (!kind) list.push({ key: 'angle', label: 'Angle', value: edgeAngle(points, pick.index), unit: '°' });
    return list;
  }
  const box = profileExtent(points), list: ShapeField[] = [
    { key: 'width', label: s.view === 'side' ? 'Into the room' : 'Width', value: box.maxX - box.minX },
    { key: 'height', label: 'Height', value: box.maxY - box.minY },
    { key: 'left', label: fromLabel(s), value: box.minX - s.origin },
    { key: 'floor', label: 'From the floor', value: box.minY },
  ];
  if (s.ref.kind === 'ceiling' && s.view === 'front') list.push({ key: 'depth', label: 'Into the room', value: s.depth, hint: 'From the wall' });
  if (outer !== undefined) list.push({ key: 'outer', label: 'Outer edge height', value: outer, hint: 'The edge at the wall stays' });
  return list;
}

/** Which side of the shape a new size moves: the side that is not held by the wall, the floor or the ceiling. */
function freeSide(s: SurfaceProfile, points: readonly ProfileVertex[], axis: 'x' | 'y'): 'minX' | 'maxX' | 'minY' | 'maxY' {
  const box = profileExtent(points), e = .05;
  if (axis === 'x') return Math.abs(box.maxX - s.bounds.maxX) < e && Math.abs(box.minX - s.bounds.minX) > e ? 'minX' : 'maxX';
  return Math.abs(box.minY - s.bounds.minY) < e || Math.abs(box.maxY - s.context.top) > e ? 'maxY' : 'minY';
}

/** The profile with one field set, or null when that size cannot be built. `depth` is not a profile change. */
export function applyShapeField(s: SurfaceProfile, points: readonly ProfileVertex[], pick: ShapePick, key: string, value: number): ProfileVertex[] | null {
  if (!Number.isFinite(value)) return null;
  const box = profileExtent(points), exact = (r: { points: ProfileVertex[]; applied: number }, want: number) => Math.abs(r.applied - want) < 1e-6 ? r.points : null;
  if (pick?.kind === 'vertex') {
    const p = points[pick.index]!;
    if (key === 'x') return movePoint(points, pick.index, { x: s.origin + value, y: p.y }, s.bounds);
    if (key === 'y') return movePoint(points, pick.index, { x: p.x, y: value }, s.bounds);
  }
  if (pick?.kind === 'edge') {
    const a = points[pick.index]!, b = points[(pick.index + 1) % points.length]!, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const normal = { x: (b.y - a.y) / l, y: -(b.x - a.x) / l };
    if (key === 'length') return setEdgeLength(points, pick.index, value, s.bounds);
    if (key === 'angle') return setEdgeAngle(points, pick.index, value, s.bounds);
    if (key === 'level') { const d = (value - a.y) * normal.y; return exact(slideEdge(points, pick.index, d, s.bounds), d); }
    if (key === 'position') { const d = (s.origin + value - a.x) * normal.x; return exact(slideEdge(points, pick.index, d, s.bounds), d); }
  }
  if (key === 'width') {
    const side = freeSide(s, points, 'x');
    return setExtent(points, side, side === 'maxX' ? box.minX + value : box.maxX - value, s.bounds);
  }
  if (key === 'height') {
    const side = freeSide(s, points, 'y');
    return setExtent(points, side, side === 'maxY' ? box.minY + value : box.maxY - value, s.bounds);
  }
  const move = (dx: number, dy: number) => {
    const moved = translateProfile(points, dx, dy, s.bounds), now = profileExtent(moved);
    return Math.abs(now.minX - box.minX - dx) < 1e-6 && Math.abs(now.minY - box.minY - dy) < 1e-6 ? moved : null;
  };
  if (key === 'left') return move(s.origin + value - box.minX, 0);
  if (key === 'floor') return move(0, value - box.minY);
  return null;
}
