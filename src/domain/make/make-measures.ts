import type { Board } from '../drawings/cabinet-boards';
import { plinthOf } from '../wardrobe/carcass';
import type { MakePart, MakePiece } from './make-parts';

/** A point in the piece's frame (centimetres: x from its left face, y up from the floor, z from its back). */
export type Vec3 = readonly [number, number, number];

/**
 * One measurement Make draws: between `a` and `b`, its line moved by `offset` (so it stands clear of the boards), and its
 * length. Rank orders them when two labels would overlap: 1 the piece, 2 its openings and fronts, 3 the part picked.
 * `part` names the front a measurement belongs to, so it hides with the fronts.
 */
export interface Measure {
  readonly rank: 1 | 2 | 3;
  readonly a: Vec3;
  readonly b: Vec3;
  readonly offset: Vec3;
  readonly length: number;
  readonly part?: number;
  /** The way the plane it lies in faces (the front, a shelf's top): it is shown only while that plane faces the viewer,
   * so measurements across the inside never collapse onto one line when the piece is seen from its side. */
  readonly face?: Vec3;
  /** A running dimension from a datum (the floor, the left face): its figure stands beside the tick at `b`, where the
   * board is, not halfway along, so a column of shelves reads as a column of heights. */
  readonly ordinate?: boolean;
}

const EPS = .01;
const extent = (b: Board) => ({ x: b.x1 - b.x0, y: b.y1 - b.y0, z: b.z1 - b.z0 });
/** How far a board is turned from level about the depth (radians, up to the right; 0 for one set square): a top
 * under a sloped ceiling, whose box is far thicker than the board itself. */
export function tiltOf(b: Board): number {
  const e = extent(b), o = b.outline;
  if (!o || o.length < 2 || Math.min(e.x, e.y, e.z) <= b.cut.thickness + .05) return 0;
  // Its outline's first side runs along the slope, from one end of its underside to the other.
  return Math.atan2(o[1]!.y - o[0]!.y, o[1]!.x - o[0]!.x);
}
/** The axis a board is thinnest along: x for a side or partition, y for a shelf, top or base (a sloped top too), z for a
 * back or a front. */
export function thinAxis(b: Board): 'x' | 'y' | 'z' {
  const e = extent(b), tilt = tiltOf(b);
  if (tilt) return Math.abs(Math.cos(tilt)) >= Math.abs(Math.sin(tilt)) ? 'y' : 'x';
  return e.x <= e.y && e.x <= e.z ? 'x' : e.y <= e.z ? 'y' : 'z';
}
const isFront = (b: Board) => b.stock === 'door' || b.stock === 'front';
const FRONT: Vec3 = [0, 0, 1], UP: Vec3 = [0, 1, 0];
const measure = (rank: Measure['rank'], a: Vec3, b: Vec3, offset: Vec3 = [0, 0, 0], part?: number, face?: Vec3): Measure => {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return { rank, a, b, offset, length, ...(part === undefined ? {} : { part }), ...(face ? { face } : {}) };
};

/** The heights a board occupies at `x`: its sloped outline's where it has one, else its box's. */
export function heightsAt(b: Board, x: number): [number, number] {
  const outline = b.outline;
  if (!outline) return [b.y0, b.y1];
  const ys: number[] = [];
  outline.forEach((p, k) => {
    const q = outline[(k + 1) % outline.length]!;
    if ((p.x - x) * (q.x - x) <= 0 && Math.abs(q.x - p.x) > 1e-6) ys.push(p.y + (q.y - p.y) * (x - p.x) / (q.x - p.x));
  });
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : [b.y0, b.y1];
}

/** The uprights standing the full carcass height (sides and partitions), left to right. */
function uprights(boards: readonly Board[], h: number): Board[] {
  return boards.filter(b => b.stock === 'carcass' && thinAxis(b) === 'x' && b.y1 - b.y0 > h * .3).sort((p, q) => p.x0 - q.x0);
}

/**
 * The measurements of the whole piece, assembled. Rank 1: width, height, depth and plinth. Rank 2: the clear width of
 * every bay under the top, the clear heights between the boards up each bay, the depth of a shelf, and the size of
 * every front. Measured face to face, never through a board.
 */
export function pieceMeasures(mp: MakePiece): Measure[] {
  const { w, h, d } = mp.size, out: Measure[] = [], boards = mp.parts.flatMap(p => p.boards);
  out.push(measure(1, [0, h, 0], [w, h, 0], [0, 10, 0]), measure(1, [w, 0, 0], [w, h, 0], [12, 0, 0]), measure(1, [w, 0, 0], [w, 0, d], [12, 0, 0]));
  const lift = plinthOf(mp.piece.design);
  if (lift > 0) out.push(measure(1, [0, 0, d], [0, lift, d], [-6, 0, 0], undefined, FRONT));
  const posts = uprights(boards, h), across = boards.filter(b => thinAxis(b) === 'y' && b.stock !== 'plinth' && !isFront(b));
  const found: { shelf?: Board } = {};
  posts.slice(0, -1).forEach((left, i) => {
    const right = posts[i + 1]!, x0 = left.x1, x1 = right.x0, mid = (x0 + x1) / 2;
    if (x1 - x0 < 2) return;
    const level = Math.min(heightsAt(left, x0)[1], heightsAt(right, x1)[1]) - 8;
    out.push(measure(2, [x0, level, d], [x1, level, d], undefined, undefined, FRONT));
    const stack = across.filter(b => b.x0 <= mid + EPS && b.x1 >= mid - EPS).sort((p, q) => heightsAt(p, mid)[0] - heightsAt(q, mid)[0]);
    stack.slice(0, -1).forEach((below, k) => {
      const above = stack[k + 1]!, y0 = heightsAt(below, mid)[1], y1 = heightsAt(above, mid)[0];
      if (y1 - y0 >= 3) out.push(measure(2, [x1 - 5, y0, d], [x1 - 5, y1, d], undefined, undefined, FRONT));
      if (k > 0 && (!found.shelf || heightsAt(below, mid)[1] > found.shelf.y1)) found.shelf = below;
    });
  });
  const shelf = found.shelf;
  if (shelf) out.push(measure(2, [shelf.x0 + 4, shelf.y1, shelf.z0], [shelf.x0 + 4, shelf.y1, shelf.z1], undefined, undefined, UP));
  // Every front: its height up its side, and its width under it, once for a column of fronts the same width (two
  // drawer fronts one above the other share one width; each has its own height).
  const widths = new Set<string>();
  for (const part of mp.parts) {
    const b = part.boards[0]!;
    if (!isFront(b)) continue;
    const column = [b.x0, b.x1, b.z1].map(v => Math.round(v * 10)).join();
    if (!widths.has(column)) {
      widths.add(column);
      const low = Math.min(...mp.parts.filter(p => isFront(p.boards[0]!)).flatMap(p => p.boards).filter(o => [o.x0, o.x1, o.z1].map(v => Math.round(v * 10)).join() === column).map(o => o.y0));
      out.push(measure(2, [b.x0, low, b.z1], [b.x1, low, b.z1], [0, -3, 0], part.n, FRONT));
    }
    out.push(measure(2, [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [3, 0, 0], part.n, FRONT));
  }
  return out;
}

/** The part picked: its length, width and thickness on its first board, and where each of its boards sits (a shelf's
 * height off the floor, an upright's distance from the left face; left out while the piece is apart). Rank 3. */
export function partMeasures(part: MakePart, withPositions = true): Measure[] {
  const b = part.boards[0]!, e = extent(b), thin = thinAxis(b), G = 4, out: Measure[] = [];
  if (tiltOf(b)) return slopeMeasures(b, withPositions);
  if (e.x > 2) out.push(measure(3, [b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [0, -G, 0]));
  if (e.y > 2) out.push(measure(3, [b.x0, b.y0, b.z1], [b.x0, b.y1, b.z1], [-G, 0, 0]));
  if (e.z > 2) out.push(measure(3, [b.x1, b.y0, b.z0], [b.x1, b.y0, b.z1], [G, 0, 0]));
  if (thin === 'x') out.push(measure(3, [b.x0, b.y1, b.z1], [b.x1, b.y1, b.z1], [0, G, 0]));
  if (thin === 'y') out.push(measure(3, [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [G, 0, 0]));
  if (thin === 'z') out.push(measure(3, [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [0, G, 0]));
  if (isFront(b) || !withPositions) return out;
  // Where each board sits: a shelf's underside up from the floor, an upright's left face across from the piece's left
  // face, as running dimensions up (or across) one line beside the boards, each figure at its own board.
  for (const board of part.boards) {
    if (thin === 'y' && board.y0 > .5) out.push({ ...measure(3, [b.x0, 0, board.z1], [b.x0, board.y0, board.z1], [-2 * G, 0, 0]), ordinate: true });
    if (thin === 'x' && board.x0 > .5) out.push({ ...measure(3, [0, b.y0, board.z1], [board.x0, b.y0, board.z1], [0, -2 * G, 0]), ordinate: true });
  }
  return out;
}

/** A sloped top: its length along the slope under it, its depth, its thickness square to its face, and the height of
 * its underside at each end. */
function slopeMeasures(b: Board, withPositions: boolean): Measure[] {
  const tilt = tiltOf(b), [p, q] = [b.outline![0]!, b.outline![1]!], c = Math.cos(tilt), s = Math.sin(tilt), t = b.cut.thickness, G = 4;
  const out = [measure(3, [p.x, p.y, b.z1], [q.x, q.y, b.z1], [s * G, -c * G, 0]), measure(3, [q.x, q.y, b.z0], [q.x, q.y, b.z1], [G, 0, 0]),
    measure(3, [q.x, q.y, b.z1], [q.x - s * t, q.y + c * t, b.z1], [c * G, s * G, 0])];
  if (withPositions) for (const [end, side] of [[p, -1], [q, 1]] as const) out.push({ ...measure(3, [end.x, 0, b.z1], [end.x, end.y, b.z1], [side * 2 * G, 0, 0]), ordinate: true });
  return out;
}

/**
 * Where a board goes when the piece is taken apart, at full amount (centimetres): sides out to their side, the top up,
 * the back behind, a partition and the base a little forward, shelves out of the front, fronts and doors furthest
 * forward, the plinth down. Every move is away from the boards it touches, so nothing passes through another board.
 */
export function apartOffset(b: Board, size: MakePiece['size'], topY: number): Vec3 {
  const { w, h, d } = size, thin = thinAxis(b), cx = (b.x0 + b.x1) / 2 / w;
  if (b.stock === 'plinth') return [0, -.12 * h, b.z1 > d * .7 ? .2 * d : b.z0 < d * .3 ? -.2 * d : 0];
  if (isFront(b)) return [(cx - .5) * .12 * w, 0, (b.stock === 'door' ? 1.2 : .75) * d];
  if (b.stock === 'back' || thin === 'z') return [0, .03 * h, -.8 * d];
  if (thin === 'x') return cx < .15 || cx > .85 ? [(cx < .5 ? -1 : 1) * .4 * w, .03 * h, 0] : [0, .04 * h, .17 * d];
  if (b.y1 >= topY - EPS) return [0, .2 * h, 0];
  return b.y0 < h * .12 ? [0, -.05 * h, .13 * d] : [0, .03 * h, .5 * d];
}
