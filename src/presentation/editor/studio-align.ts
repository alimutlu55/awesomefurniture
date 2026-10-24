import { roomHeight } from '../../domain/studio/studio';
import type { Studio, StudioCeiling, StudioOpening, StudioWall } from '../../domain/studio/studio';
import { outerEdgeHeight } from '../../domain/studio/ceiling-edge';
import { ceilingFrame } from '../../domain/studio/studio-ceiling';
import { wallLine } from '../../domain/studio/studio';
import type { Align, AlignTarget } from '../../domain/geometry/alignment';
import type { Guide } from './studio-drag';

/** What an opening or a ceiling shape lines up with while it is dragged: the other openings on its wall, the
 * other shapes in the room. Plain lists of candidates for `resolveAlignment` (`alignTo`) and the guide each
 * one draws, in scene centimetres. */

const round = (v: number) => Math.round(v * 10) / 10;
const heads = (room: Studio, wall: string, skip?: string) => room.openings.filter(o => o.wall === wall && o.id !== skip);

/** Offsets an opening can take along its wall to share a centre or an edge with a neighbour, and sills that
 * share a sill or a top. */
export function openingTargets(room: Studio, o: StudioOpening) {
  const along: Align[] = [], up: Align[] = [];
  for (const s of heads(room, o.wall, o.id)) {
    along.push({ v: round(s.offset), label: 'Aligned with opening' },
      { v: round(s.offset - s.width / 2 + o.width / 2), label: 'Aligned with opening' },
      { v: round(s.offset + s.width / 2 - o.width / 2), label: 'Aligned with opening' });
    up.push({ v: round(s.sill), label: 'Aligned with opening' }, { v: round(s.sill + s.height - o.height), label: 'Aligned with opening' });
  }
  return { along, up };
}
/** A line down the wall's room face through `offset`, or across it at `sill` (`offset` null). */
export function openingGuide(room: Studio, w: StudioWall, offset: number | null, y: number | null): Guide[] {
  const line = wallLine(room, w);
  if (!line) return [];
  const z = w.thickness / 2 + 1, at = (s: number, h: number) => ({ x: line.a.x + line.ux * s + line.nx * z, y: h, z: line.a.z + line.uz * s + line.nz * z });
  if (offset !== null) return [{ a: at(offset, 0), b: at(offset, w.height), label: 'Aligned with opening' }];
  const length = Math.hypot(line.b.x - line.a.x, line.b.z - line.a.z);
  return y === null ? [] : [{ a: at(0, y), b: at(length, y), label: 'Aligned with opening' }];
}

export interface Standing { readonly x: number; readonly z: number; readonly angle: number; readonly w: number; readonly d: number; readonly h: number }

/** Each wardrobe beside a ceiling shape, as the distance into the room of its nearest and furthest face from
 * the wall, and its height. `under` marks one standing where the shape comes down: its top follows the shape,
 * so it is never something the shape lines up with. */
function beside(room: Studio, c: StudioCeiling, standing: readonly Standing[]) {
  const fr = ceilingFrame(room, c);
  if (!fr) return [];
  return standing.flatMap(f => {
    const a = f.angle * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), vx = Math.sin(a), vz = Math.cos(a);
    const pts = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([i, j]) => fr.local({ x: f.x + i * f.w / 2 * ux + j * f.d / 2 * vx, z: f.z + i * f.w / 2 * uz + j * f.d / 2 * vz }));
    const near = Math.min(...pts.map(p => p.d)), far = Math.max(...pts.map(p => p.d)), from = Math.min(...pts.map(p => p.s)), to = Math.max(...pts.map(p => p.s));
    // Anything standing against this wall, level with the shape or beside it along the wall.
    if (far < -.5 || near > 400 || from > fr.face.end + 5 || to < fr.face.start - 5) return [];
    const overlaps = to > fr.along.from + .5 && from < fr.along.to - .5;
    return [{ near, far, h: f.h, under: overlaps && near < c.depth - .5 }];
  });
}

/** Depths a ceiling shape on a wall can reach to match another shape on the same wall, or the face of a
 * wardrobe in front of it. */
export function depthTargets(room: Studio, c: StudioCeiling, standing: readonly Standing[] = []): Align[] {
  const out: Align[] = (room.ceilings ?? []).filter(o => o.id !== c.id && o.wall === c.wall && o.run === 'along').map(o => ({ v: round(o.depth), label: 'Aligned with shape' }));
  const fr = ceilingFrame(room, c);
  // The face of another wall that runs the same way: the shape reaches exactly to it.
  for (const o of room.walls) {
    const ol = o.id === c.wall || !fr ? null : wallLine(room, o);
    if (!ol || !fr || Math.abs(ol.ux * fr.line.uz - ol.uz * fr.line.ux) > 1e-3) continue;
    const centre = (ol.a.x - fr.line.a.x) * fr.line.nx + (ol.a.z - fr.line.a.z) * fr.line.nz - fr.off;
    for (const v of [centre - o.thickness / 2, centre + o.thickness / 2]) if (v > 1) out.push({ v: round(v), label: 'Aligned with wall' });
  }
  for (const f of beside(room, c, standing)) for (const v of [f.near, f.far]) if (v > 1) out.push({ v: round(v), label: 'Aligned with wardrobe' });
  return out;
}
/** A line at `depth` from the wall across the ceiling's reach, on the floor and level with the grip (`y`), where
 * the eye is. */
export function depthGuide(room: Studio, c: StudioCeiling, depth: number, y: number): Guide[] {
  const fr = ceilingFrame(room, c);
  if (!fr) return [];
  // Reaching past the shape on both sides, so it runs on to the wall it lines up with.
  const a = fr.at(fr.along.from - 150, depth), b = fr.at(fr.along.to + 150, depth);
  return [{ a, b, label: 'Aligned' }, { a: { ...a, y }, b: { ...b, y }, label: 'Aligned' }];
}

/** Heights on the model a ceiling edge can match: the other shapes' edges and low points, the top of
 * wardrobes beside it, and the top of every door or window on its wall. */
export function heightTargets(room: Studio, c: StudioCeiling, standing: readonly Standing[] = []): Align[] {
  const out: Align[] = [], top = roomHeight(room);
  for (const o of room.ceilings ?? []) {
    if (o.id === c.id) continue;
    const ys = new Set([outerEdgeHeight(o), ...o.profile.map(p => p.y)]);
    for (const y of ys) if (y > 1 && y < top - .5) out.push({ v: round(y), label: 'Aligned with shape' });
  }
  for (const f of beside(room, c, standing)) if (!f.under && f.h > 1 && f.h < top - .5) out.push({ v: round(f.h), label: 'Aligned with wardrobe' });
  for (const o of heads(room, c.wall)) if (o.sill + o.height < top - .5) out.push({ v: round(o.sill + o.height), label: 'Aligned with opening' });
  return out;
}
/** A level line across the room at height `y`, through the grip. */
export function heightGuide(room: Studio, c: StudioCeiling, at: { x: number; z: number }, y: number): Guide[] {
  const fr = ceilingFrame(room, c);
  if (!fr) return [];
  const r = 90, ux = fr.line.ux * r, uz = fr.line.uz * r;
  return [{ a: { x: at.x - ux, y, z: at.z - uz }, b: { x: at.x + ux, y, z: at.z + uz }, label: 'Aligned with shape' }];
}
/** Moves that put a lifted shape's lowest or highest point on a target height. */
export function liftTargets(c: StudioCeiling, heights: readonly Align[]): AlignTarget<number>[] {
  const ys = c.profile.map(p => p.y), pts = [Math.min(...ys), Math.max(...ys)];
  return heights.flatMap(h => pts.map(y => ({ v: round(h.v - y), label: h.label, src: h.v })));
}
