import { wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio, StudioFixture } from '../../domain/studio/studio';
import { isWallUtility } from '../../domain/studio/wall-utilities';
import { reachAt } from '../../domain/studio/studio-ceiling';
import { fixtureKind } from '../../domain/studio/fixtures/fixture-kinds';
import { fixturePlace } from '../../domain/studio/fixtures/fixture-place';
import { standingAgainst, standsOnFloor } from '../../domain/studio/fixtures/fixture-setup';
import type { AlignTarget } from '../../domain/geometry/alignment';
import { measureNumber, unitSuffix } from './editor-format.js';
import type { Guide } from './studio-drag';
import type { RoomMeasure } from './studio-editor.ports';

const round = (v: number) => Math.round(v * 10) / 10;
const text = (v: number) => measureNumber(round(v)) + unitSuffix();
const noun = (f: StudioFixture) => fixtureKind(f.kind)?.name.toLowerCase() ?? 'fixture';
/** A value a fixture's middle can slide to along its wall; `src` is where along the wall its guide is drawn. */
export type FixtureTarget = AlignTarget<number>;

/** Where a fixture slid along its wall lines up: its middle on the wall's, a window's or a boxing's; its side against
 * a wall end, or the clearance a person needs beside it; its side flush with a boxing's end, or that clearance from
 * the fixture beside it. Each is a value of its middle, along the wall from corner a. */
export function fixtureTargets(room: Studio, f: StudioFixture): FixtureTarget[] {
  const w = room.walls.find(x => x.id === f.wall), face = w && wallFace(room, w), k = fixtureKind(f.kind);
  if (!face || !k) return [];
  const half = f.width / 2, mid = (face.start + face.end) / 2, out: FixtureTarget[] = [{ v: mid, label: 'Centred on the wall', src: mid }];
  for (const o of room.openings) if (o.wall === f.wall && o.kind === 'window') out.push({ v: o.offset, label: 'Centred under the window', src: o.offset });
  for (const c of room.ceilings ?? []) {
    // Its own boxing goes with it (slideFixture), so it is nothing to line up with.
    if (c.wall !== f.wall || c.run !== 'along' || !standsOnFloor(c) || standingAgainst(room, c.id).every(x => x.id === f.id)) continue;
    const ts = c.outline!.map(p => p.t), from = Math.min(...ts), to = Math.max(...ts);
    out.push({ v: (from + to) / 2, label: 'Centred on the boxing', src: (from + to) / 2 },
      { v: from + half, label: 'Flush with the boxing', src: from }, { v: to - half, label: 'Flush with the boxing', src: to },
      { v: from - half, label: 'Beside the boxing', src: from }, { v: to + half, label: 'Beside the boxing', src: to });
  }
  out.push({ v: face.start + half, label: 'Against the wall', src: face.start }, { v: face.end - half, label: 'Against the wall', src: face.end },
    { v: face.start + half + k.side, label: `${k.side}${unitSuffix()} from the wall`, src: face.start },
    { v: face.end - half - k.side, label: `${k.side}${unitSuffix()} from the wall`, src: face.end });
  for (const other of room.fixtures ?? []) {
    if (other.id === f.id || other.wall !== f.wall) continue;
    const gap = Math.max(k.side, fixtureKind(other.kind)?.side ?? 0), l = other.offset - other.width / 2, r = other.offset + other.width / 2;
    out.push({ v: l - gap - half, label: `${gap}${unitSuffix()} from the ${noun(other)}`, src: l }, { v: r + gap + half, label: `${gap}${unitSuffix()} from the ${noun(other)}`, src: r });
  }
  return out.map(t => ({ ...t, v: round(t.v) }));
}

/** The guide for a caught target: a line up the wall's face where the fixture lines up. */
export function fixtureGuide(room: Studio, f: StudioFixture, target: FixtureTarget): Guide[] {
  const w = room.walls.find(x => x.id === f.wall), line = w && wallLine(room, w);
  if (!w || !line || target.src === undefined) return [];
  const z = w.thickness / 2 + 1, at = (y: number) => ({ x: line.a.x + line.ux * target.src! + line.nx * z, y, z: line.a.z + line.uz * target.src! + line.nz * z });
  return [{ a: at(0), b: at(Math.min(w.height, 210)), label: target.label }];
}

/** What a carpenter reads for a selected or dragged fixture: the gaps to its sides along the wall (to the wall's end,
 * or to the door, fixture, boxing or pillar beside it), how far it stands out from the wall in all (boxing and bowl), and the
 * free floor in front of it, amber when it is less than a person needs to use it. Tap a gap to the wall's end to type it. */
export function fixtureMeasures(room: Studio, id: string, dragging: boolean): RoomMeasure[] {
  const f = room.fixtures?.find(x => x.id === id), place = f && fixturePlace(room, f), k = f && fixtureKind(f.kind);
  if (!f || !place || !k) return [];
  const { face, back, extent } = place, half = f.width / 2;
  const at = (s: number, d: number, y: number) => { const p = place.at(s, d); return { x: p.x, y, z: p.z }; };
  // The nearest edge on each side along the wall, at the fixture's height: a wall end, a door, another fixture or a shape on the floor.
  const edges: { s: number; wall: boolean }[] = [{ s: face.start, wall: true }, { s: face.end, wall: true }];
  for (const o of room.openings) if (o.wall === f.wall && !isWallUtility(o.kind) && o.sill < extent.top) edges.push({ s: o.offset - o.width / 2 - 7, wall: false }, { s: o.offset + o.width / 2 + 7, wall: false });
  for (const x of room.fixtures ?? []) if (x.id !== f.id && x.wall === f.wall) edges.push({ s: x.offset - x.width / 2, wall: false }, { s: x.offset + x.width / 2, wall: false });
  // A boxing or pillar beside it that reaches its height (not its own boxing, which it stands in front of).
  for (const c of room.ceilings ?? []) {
    if (c.wall !== f.wall || !standsOnFloor(c) || standingAgainst(room, c.id).some(x => x.id === f.id) || Math.max(...c.outline!.map(p => p.y)) <= extent.bottom) continue;
    const ts = c.outline!.map(p => p.t);
    edges.push({ s: Math.min(...ts), wall: false }, { s: Math.max(...ts), wall: false });
  }
  const l = f.offset - half, r = f.offset + half;
  const left = edges.filter(e => e.s <= l + .01).sort((a, b) => b.s - a.s)[0]!, right = edges.filter(e => e.s >= r - .01).sort((a, b) => a.s - b.s)[0]!;
  const y = extent.top + 6, d = back + f.depth / 2;
  const gap = (from: number, to: number, side: 'left' | 'right', wallEnd: boolean): RoomMeasure | null => to - from < .5 ? null
    : { a: at(from, d, y), b: at(to, d, y), text: text(to - from), ...(!dragging && wallEnd ? { edit: side } : {}) };
  const out = [gap(left.s, l, 'left', left.wall), gap(r, right.s, 'right', right.wall)];
  if (!dragging) {
    // Out from the wall's face to its front: what the toilet takes from the room, boxing included.
    out.push({ a: at(r + 6, 0, 1), b: at(r + 6, back + f.depth, 1), text: text(back + f.depth) });
    const reach = reachAt(room, f.wall, f.offset), free = reach === null ? null : reach - back - f.depth;
    if (free !== null && free > .5 && free < 250) out.push({ a: at(f.offset, back + f.depth, 1), b: at(f.offset, back + f.depth + free, 1), text: text(free), ...(free < k.use ? { tone: 'warn' as const } : {}) });
  }
  return out.filter((m): m is RoomMeasure => !!m);
}
