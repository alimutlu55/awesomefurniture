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

/** Depths a ceiling shape on a wall can reach to match another shape on the same wall. */
export function depthTargets(room: Studio, c: StudioCeiling): Align[] {
  return (room.ceilings ?? []).filter(o => o.id !== c.id && o.wall === c.wall && o.run === 'along').map(o => ({ v: round(o.depth), label: 'Aligned with shape' }));
}
/** A line on the floor at `depth` from the wall, across the ceiling's reach. */
export function depthGuide(room: Studio, c: StudioCeiling, depth: number): Guide[] {
  const fr = ceilingFrame(room, c);
  if (!fr) return [];
  const a = fr.at(fr.along.from, depth), b = fr.at(fr.along.to, depth);
  return [{ a, b, label: 'Aligned with shape' }];
}

/** Heights on the model a ceiling edge can match: the other shapes' edges and low points, and the top of
 * every door or window on its wall. */
export function heightTargets(room: Studio, c: StudioCeiling): Align[] {
  const out: Align[] = [], top = roomHeight(room);
  for (const o of room.ceilings ?? []) {
    if (o.id === c.id) continue;
    const ys = new Set([outerEdgeHeight(o), ...o.profile.map(p => p.y)]);
    for (const y of ys) if (y > 1 && y < top - .5) out.push({ v: round(y), label: 'Aligned with shape' });
  }
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
