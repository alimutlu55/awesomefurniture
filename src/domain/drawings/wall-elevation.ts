import type { Studio } from '../studio/studio';
import { kitchenSpans, unitAxes } from '../kitchen/kitchen-runs';
import { plinthOf } from '../wardrobe/carcass';
import { type Item, line, mm, note, rect, stops } from './drawing';
import { type PlacedPiece, wallGeometry } from './room-pieces';
import { pieceFront, pieceHeights } from './piece-front';
import { openingNote } from './opening-notes';

/** How far the floor line runs past the wall's ends. Millimetres. */
const FLOOR_RUN = 300;
/** A piece on another wall this close to this wall's face is seen at its end, as a return. Centimetres. */
const RETURN = 5;

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
  /** How far along this wall a footprint reaches, and how close it comes to the wall's face. */
  const reach = (cx: number, cz: number, angle: number, w: number, d: number) => {
    const { u, v } = unitAxes(angle), pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: cx + u.x * a! * w / 2 + v.x * b! * d / 2, z: cz + u.z * a! * w / 2 + v.z * b! * d / 2 }));
    const ts = pts.map(q => face.start + (q.x - face.from.x) * l.ux + (q.z - face.from.z) * l.uz), ss = pts.map(q => (q.x - face.from.x) * l.nx + (q.z - face.from.z) * l.nz);
    return { t0: Math.min(...ts), t1: Math.max(...ts), near: Math.min(...ss) < RETURN && Math.max(...ts) > face.start + .5 && Math.min(...ts) < face.end - .5 };
  };
  // Worktops and plinths over the runs standing here, and the ends of runs along the walls beside it (returns).
  const ids = new Set(mine.map(p => p.id)), poses = pieces.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z, angle: p.angle, state: p.design }));
  const worktops: number[] = [];
  for (const s of kitchenSpans(poses)) {
    const r = reach(s.x, s.z, s.angle, s.length, s.depth);
    if (!s.units.some(id => ids.has(id as number)) && !r.near) continue;
    out.push(rect(mm(x(r.t0)), mm(s.y), mm(x(r.t1)), mm(s.y + s.height), s.kind === 'worktop' ? 'outline' : 'thin'));
    if (s.kind === 'worktop') worktops.push(s.y, s.y + s.height);
  }
  for (const p of mine) out.push(...pieceFront(p, x(p.lo)));
  // A piece on the next wall that comes into this wall's corner is seen from its side: its outline and mark.
  const returns = pieces.filter(p => p.wall !== wallId && !p.fixture).map(p => ({ p, ...reach(p.x, p.z, p.angle, p.design.w, p.design.d) })).filter(r => r.near);
  for (const { p, t0, t1 } of returns) {
    const top = Math.max(...pieceHeights(p)), plinth = plinthOf(p.design);
    out.push(rect(mm(x(t0)), mm(p.y), mm(x(t1)), mm(top), 'outline'));
    if (plinth > 0) out.push(line({ x: mm(x(t0)), y: mm(p.y + plinth) }, { x: mm(x(t1)), y: mm(p.y + plinth) }, 'thin'));
    out.push({ kind: 'tag', at: { x: mm(x((t0 + t1) / 2)), y: mm((p.y + top) / 2) }, text: p.mark });
  }
  const side = (hung: boolean) => returns.filter(r => r.p.hung === hung).map(r => ({ lo: r.t0, hi: r.t1 }));
  const floor = [...mine.filter(p => !p.hung && !p.fixture), ...side(false)], hung = [...mine.filter(p => p.hung), ...side(true)];
  const across = (values: readonly number[], up: boolean, row: number) =>
    out.push({ kind: 'dims', origin: { x: 0, y: up ? mm(height) : 0 }, dir: { x: 1, y: 0 }, side: up ? 1 : -1, clear: 0, row,
      stops: stops([0, mm(length), ...values.map(v => mm(Math.max(0, Math.min(length, v))))]) });
  let below = 0, above = 0;
  if (floor.length) across(floor.flatMap(p => [x(p.lo), x(p.hi)]), false, below++);
  across([], false, below);
  if (hung.length) across(hung.flatMap(p => [x(p.lo), x(p.hi)]), true, above++);
  if (g.openings.length) across(g.openings.flatMap(o => [x(o.offset - o.width / 2), x(o.offset + o.width / 2)]), true, above);
  const heights = [...mine.flatMap(pieceHeights), ...returns.flatMap(r => pieceHeights(r.p)), ...worktops];
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
