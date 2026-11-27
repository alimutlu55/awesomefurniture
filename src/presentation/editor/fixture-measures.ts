import type { StudioFixture } from '../../domain/studio/studio';
import { isWallUtility } from '../../domain/studio/wall-utilities';
import { reachAt } from '../../domain/studio/studio-ceiling';
import { fixturePlace } from '../../domain/studio/fixtures/fixture-place';
import { standingAgainst, standsOnFloor } from '../../domain/studio/fixtures/fixture-setup';
import type { PieceGap, Room } from '../../domain/pieces/piece-model';
import { fixturePiece } from '../../domain/pieces/pieces';
import { measureNumber, unitSuffix } from './editor-format.js';
import type { RoomMeasure } from './studio-editor.ports';

export const fixtureMeasureText = (cm: number) => measureNumber(Math.round(cm * 10) / 10) + unitSuffix();

/** What a carpenter reads for a selected or dragged fixture: the gaps to its sides along the wall (to the wall's end,
 * or to the door, fixture, boxing or pillar beside it), how far it stands out from the wall in all (boxing and bowl), and the
 * free floor in front of it, amber when it is less than a person needs to use it. Tap a gap to the wall's end to type it. */
export function fixtureMeasures(room: Room, f: StudioFixture, dragging: boolean): RoomMeasure[] {
  const studio = room.studio, place = studio && fixturePlace(studio, f);
  if (!studio || !place) return [];
  const piece = fixturePiece(f);
  const furniture = { studio, bodies: room.bodies.filter(body => body.key.family !== 'fixture') };
  const furnitureGaps = piece.gaps(furniture, { includeWalls: false, includeContact: true });
  const nearby = (side: PieceGap['side']) => furnitureGaps.find(gap => gap.side === side)?.distance ?? Infinity;
  const { face, back, extent } = place, half = f.width / 2;
  const at = (s: number, d: number, y: number) => { const p = place.at(s, d); return { x: p.x, y, z: p.z }; };
  // The nearest edge on each side along the wall, at the fixture's height: a wall end, a door, another fixture or a shape on the floor.
  const edges: { s: number; wall: boolean }[] = [{ s: face.start, wall: true }, { s: face.end, wall: true }];
  for (const o of studio.openings) if (o.wall === f.wall && !isWallUtility(o.kind) && o.sill < extent.top) edges.push({ s: o.offset - o.width / 2 - 7, wall: false }, { s: o.offset + o.width / 2 + 7, wall: false });
  for (const x of studio.fixtures ?? []) if (x.id !== f.id && x.wall === f.wall) edges.push({ s: x.offset - x.width / 2, wall: false }, { s: x.offset + x.width / 2, wall: false });
  // A boxing or pillar beside it that reaches its height (not its own boxing, which it stands in front of).
  for (const c of studio.ceilings ?? []) {
    if (c.wall !== f.wall || !standsOnFloor(c) || standingAgainst(studio, c.id).some(x => x.id === f.id) || Math.max(...c.outline!.map(p => p.y)) <= extent.bottom) continue;
    const ts = c.outline!.map(p => p.t);
    edges.push({ s: Math.min(...ts), wall: false }, { s: Math.max(...ts), wall: false });
  }
  const l = f.offset - half, r = f.offset + half;
  const left = edges.filter(e => e.s <= l + .01).sort((a, b) => b.s - a.s)[0]!, right = edges.filter(e => e.s >= r - .01).sort((a, b) => a.s - b.s)[0]!;
  const y = extent.top + 6, d = back + f.depth / 2;
  const gap = (from: number, to: number, side: 'left' | 'right', wallEnd: boolean): RoomMeasure | null => to - from < .5 ? null
    : { a: at(from, d, y), b: at(to, d, y), text: fixtureMeasureText(to - from), ...(!dragging && wallEnd ? { edit: side } : {}) };
  const leftLimit = nearby('left'), rightLimit = nearby('right');
  const out = [
    gap(Math.max(left.s, l - leftLimit), l, 'left', left.wall && l - left.s <= leftLimit),
    gap(r, Math.min(right.s, r + rightLimit), 'right', right.wall && right.s - r <= rightLimit),
  ];
  if (!dragging) {
    // Out from the wall's face to its front: what the toilet takes from the room, boxing included.
    out.push({ a: at(r + 6, 0, 1), b: at(r + 6, back + f.depth, 1), text: fixtureMeasureText(back + f.depth) });
    const reach = reachAt(studio, f.wall, f.offset);
    const free = Math.min(nearby('front'), reach === null ? Infinity : reach - back - f.depth);
    if (free > .5 && free < 250) {
      out.push({ a: at(f.offset, back + f.depth, 1), b: at(f.offset, back + f.depth + free, 1), text: fixtureMeasureText(free),
        ...(free < piece.needs.front ? { tone: 'warn' as const } : {}) });
    }
  }
  return out.filter((m): m is RoomMeasure => !!m);
}
