import type { FittingKind, Hole } from './make-joints';
import type { MakePiece } from './make-parts';
import type { Measure, Vec3 } from './make-measures';

/** How far from its hole a fastener waits (centimetres) before it goes in, along the dashed line it goes in by. */
export const WAIT = 10;
/** Hardware put in before the boards it joins come together, into a board lying on the floor or one already standing:
 * a cam's bolt into the face board, dowels into a board's end, a hinge's cup into the back of its door laid face down,
 * a hinge's plate onto the side panel the door will hang from. */
export const FITTED_BEFORE: ReadonlySet<FittingKind> = new Set(['bolt', 'dowel', 'hinge', 'plate']);

/** Where a fitting goes in: the point it ends at (a screw's head at the hole's mouth), the way it travels (a unit
 * vector, into the board) and the board it goes in through (null for hardware standing on its own). */
export interface Entry { readonly at: Vec3; readonly dir: Vec3; readonly board: number | null }
/** A step's fitting done together, as a maker would: the fittings going in through one board from one side. */
export interface FixGroup { readonly items: readonly number[]; readonly dir: Vec3; readonly board: number | null }

const unit = (axis: number, sign: number): Vec3 => [axis === 0 ? sign : 0, axis === 1 ? sign : 0, axis === 2 ? sign : 0];
const along = (h: Hole) => unit(h.axis, h.sign);

/** Where and which way a fitting goes in, or null for one that is not put in by the film (runners come on their box). */
export function entryOf(piece: MakePiece, item: number): Entry | null {
  const f = piece.fittings[item]!, mine = piece.holes.filter(h => h.of === item), first = f.boards[0] ?? null;
  const through = (h: Hole | undefined, at: Vec3 = h?.at ?? f.at): Entry | null => h ? { at, dir: along(h), board: h.board } : null;
  // The back is nailed from behind, into whichever board it covers: through the board furthest back.
  const back = () => f.boards[0] ?? null;
  switch (f.kind) {
    case 'confirmat': case 'screw': return through(mine.find(h => h.kind === 'connector' || h.kind === 'screw' || h.kind === 'runner' || h.kind === 'pilot'));
    case 'cam': return through(mine.find(h => h.kind === 'cam'));
    case 'bolt': return through(mine.find(h => h.kind === 'bolt'));
    case 'dowel': return through(mine.find(h => h.depth === 25) ?? mine[0], f.at);
    case 'pin': return through(mine[2] ?? mine[0], f.at);
    case 'nail': return { at: f.at, dir: unit(f.axis, 1), board: back() };
    case 'hinge': return { at: f.at, dir: [0, 0, 1], board: first };
    case 'plate': return { at: f.at, dir: f.size?.includes('cargo') ? [0, 0, 1] : unit(0, mine[0]?.sign ?? 1), board: first };
    case 'handle': return { at: f.at, dir: [0, 0, -1], board: first };
    // Legs are stood on the floor first and the base set down on them.
    case 'leg': return { at: f.at, dir: [0, 1, 0], board: null };
    case 'hanger': case 'bracket': return { at: f.at, dir: [0, 0, 1], board: null };
    case 'rail': case 'support': return f.size?.includes('cargo') ? null : { at: f.at, dir: [0, 0, -1], board: null };
    case 'runner': return null;
  }
}

/** Fittings further apart than this (centimetres) are two places to look, each fixed in its own turn. */
const APART = 45, MOST = 9;

/**
 * A step's fixing, joint by joint: its fittings (but `skip`, fitted before the boards come in) gathered by the board
 * they go in through and the side they go in from, a gathering far apart split into the places it is at (unless that
 * makes the step too long), each from the bottom up, and the screws in each in a row.
 */
export function fixGroups(piece: MakePiece, items: readonly number[], skip: (item: number) => boolean): FixGroup[] {
  const groups = new Map<string, { items: number[]; dir: Vec3; board: number | null }>();
  for (const i of items) {
    const e = skip(i) ? null : entryOf(piece, i);
    if (!e) continue;
    const key = `${e.board}:${e.dir.join()}`, g = groups.get(key) ?? { items: [], dir: e.dir, board: e.board };
    g.items.push(i);
    groups.set(key, g);
  }
  const at = (i: number) => piece.fittings[i]!.at, low = (g: FixGroup) => Math.min(...g.items.map(i => at(i)[1]));
  const order = (a: number, b: number) => at(a)[1] - at(b)[1] || at(a)[0] - at(b)[0] || at(a)[2] - at(b)[2];
  const whole = [...groups.values()], split = whole.flatMap(g => places(g.items, at).map(items => ({ ...g, items })));
  return (split.length <= MOST ? split : whole).map(g => ({ ...g, items: [...g.items].sort(order) }))
    .sort((a, b) => Math.round(low(a) / 20) - Math.round(low(b) / 20) || order(a.items[0]!, b.items[0]!));
}

/** Fittings in the places they are at: each within APART of another in its place. */
function places(items: readonly number[], at: (i: number) => Vec3) {
  const out: number[][] = [];
  for (const i of items) {
    const near = out.filter(p => p.some(j => Math.hypot(at(i)[0] - at(j)[0], at(i)[1] - at(j)[1], at(i)[2] - at(j)[2]) <= APART));
    const merged = [i, ...near.flat()];
    for (const p of near) out.splice(out.indexOf(p), 1);
    out.push(merged);
  }
  return out;
}

/** The gaps a door is adjusted to, as measurements on the front: between neighbouring doors, and over a door with no
 * neighbour, to the top of the piece. Centimetres; Make draws them while the doors chapter adjusts. */
export function doorGaps(piece: MakePiece): Measure[] {
  const doors = piece.boards.filter(b => b.stock === 'door'), top = Math.max(...piece.boards.map(b => b.y1)), out: Measure[] = [];
  for (const a of doors) {
    const next = doors.filter(b => b.x0 >= a.x1 - .01 && b.x0 - a.x1 < 1 && b.y0 < a.y1 && b.y1 > a.y0).sort((p, q) => p.x0 - q.x0)[0];
    const z = Math.max(a.z1, next?.z1 ?? a.z1);
    if (next) {
      const y = (Math.max(a.y0, next.y0) + Math.min(a.y1, next.y1)) / 2;
      out.push({ rank: 1, a: [a.x1, y, z], b: [next.x0, y, z], offset: [0, 6, 0], length: next.x0 - a.x1, face: [0, 0, 1] });
    } else if (!doors.some(b => b.x1 <= a.x0 + .01 && a.x0 - b.x1 < 1 && b.y0 < a.y1 && b.y1 > a.y0) && top - a.y1 < 1) {
      const x = (a.x0 + a.x1) / 2;
      out.push({ rank: 1, a: [x, a.y1, z], b: [x, top, z], offset: [6, 0, 0], length: top - a.y1, face: [0, 0, 1] });
    }
  }
  return out;
}
