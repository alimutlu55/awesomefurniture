import type { Studio } from '../studio/studio';
import { kitchenSpans } from '../kitchen/kitchen-runs';
import { type Item, line, mm, note, rect, stops } from './drawing';
import { type PlacedPiece, wallGeometry } from './room-pieces';
import { pieceFront, pieceHeights } from './piece-front';
import { openingNote } from './opening-notes';

/** How far the floor line runs past the wall's ends. Millimetres. */
const FLOOR_RUN = 300;

/**
 * A wall seen from the room, as a carpenter fits against it: the wall's face from end to end and floor to its
 * height, its openings, and every piece standing against it, with the worktop and plinth of a kitchen run.
 * Along the floor: the floor-standing pieces with the gaps beside them, then the wall's length; above: the wall
 * units and the openings. On the left the height of everything from the floor (plinth, carcass, worktop, the
 * gap to the wall units, their top, the ceiling); on the right each opening's sill and head. Millimetres from
 * the wall's left end and the floor.
 */
export function wallElevation(studio: Studio, wallId: string, pieces: readonly PlacedPiece[]): Item[] {
  const w = studio.walls.find(x => x.id === wallId), g = w && wallGeometry(studio, w);
  if (!w || !g) return [];
  const { face, line: l } = g, length = face.length, height = w.height, x = (t: number) => t - face.start;
  const mine = pieces.filter(p => p.wall === wallId), out: Item[] = [];
  out.push(rect(0, 0, mm(length), mm(height), 'thin'));
  out.push(line({ x: -FLOOR_RUN, y: 0 }, { x: mm(length) + FLOOR_RUN, y: 0 }, 'cut'));
  for (const o of g.openings) {
    const a = x(o.offset - o.width / 2), b = x(o.offset + o.width / 2);
    out.push(rect(mm(a), mm(o.sill), mm(b), mm(o.sill + o.height), 'outline', o.kind === 'window' ? 'glass' : undefined));
    out.push(note({ x: mm((a + b) / 2), y: mm(o.sill + o.height) - 120 }, openingNote(o)));
  }
  // Worktops and plinths over the runs standing here: the plinth is drawn in front, set back under the carcass.
  const ids = new Set(mine.map(p => p.id)), poses = pieces.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z, angle: p.angle, state: p.design }));
  const worktops: number[] = [];
  for (const s of kitchenSpans(poses)) {
    if (!s.units.some(id => ids.has(id as number))) continue;
    const t = face.start + (s.x - face.from.x) * l.ux + (s.z - face.from.z) * l.uz, a = x(t - s.length / 2), b = x(t + s.length / 2);
    out.push(rect(mm(a), mm(s.y), mm(b), mm(s.y + s.height), s.kind === 'worktop' ? 'outline' : 'thin'));
    if (s.kind === 'worktop') worktops.push(s.y, s.y + s.height);
  }
  for (const p of mine) out.push(...pieceFront(p, x(p.lo)));
  const floor = mine.filter(p => !p.hung && !p.fixture), hung = mine.filter(p => p.hung);
  const across = (values: readonly number[], up: boolean, row: number) =>
    out.push({ kind: 'dims', origin: { x: 0, y: up ? mm(height) : 0 }, dir: { x: 1, y: 0 }, side: up ? 1 : -1, clear: 0, row,
      stops: stops([0, mm(length), ...values.map(v => mm(Math.max(0, Math.min(length, v))))]) });
  let below = 0, above = 0;
  if (floor.length) across(floor.flatMap(p => [x(p.lo), x(p.hi)]), false, below++);
  across([], false, below);
  if (hung.length) across(hung.flatMap(p => [x(p.lo), x(p.hi)]), true, above++);
  if (g.openings.length) across(g.openings.flatMap(o => [x(o.offset - o.width / 2), x(o.offset + o.width / 2)]), true, above);
  const heights = [...mine.flatMap(pieceHeights), ...worktops];
  out.push({ kind: 'dims', origin: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, side: 1, clear: 0, row: 0, stops: stops([0, mm(height), ...heights.map(mm)]) });
  if (g.openings.length) {
    out.push({ kind: 'dims', origin: { x: mm(length), y: 0 }, dir: { x: 0, y: 1 }, side: -1, clear: 0, row: 0,
      stops: stops([0, mm(height), ...g.openings.flatMap(o => [mm(o.sill), mm(o.sill + o.height)])]) });
  }
  return out;
}

/** A piece standing free (or with no room around it) seen from the front: its width along the floor, its heights on
 * the left. Millimetres from its left face and the floor. */
export function pieceElevation(p: PlacedPiece): Item[] {
  const out = pieceFront(p, 0);
  out.push(line({ x: -FLOOR_RUN, y: mm(p.y) }, { x: mm(p.design.w) + FLOOR_RUN, y: mm(p.y) }, p.y < .5 ? 'cut' : 'thin'));
  out.push({ kind: 'dims', origin: { x: 0, y: mm(p.y) }, dir: { x: 1, y: 0 }, side: -1, clear: 0, row: 0, stops: [0, mm(p.design.w)] });
  out.push({ kind: 'dims', origin: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, side: 1, clear: 0, row: 0, stops: stops([0, ...pieceHeights(p).map(mm)]) });
  return out;
}
