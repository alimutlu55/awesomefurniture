import type { Board } from '../drawings/cabinet-boards';
import type { MakePiece } from './make-parts';
import { thinAxis, type Vec3 } from './make-measures';

/**
 * Where each board waits before it goes in: lying flat on the floor in front of the piece, in the order they are
 * needed, in rows, as parts come out of the box. Centimetres in the piece's frame (y from the piece's own floor line,
 * so a hung unit's parts lie `floor` below it). `lie` turns the board flat: a quarter turn about x or z, then about y
 * when that puts its length across the room.
 */
export interface Staged { readonly at: Vec3; readonly lie: 'x' | 'z' | null; readonly spin: boolean; readonly size: Vec3 }

const GAP = 8, FRONT = 30;

/** A board's size lying flat: [across the room, thickness, front to back], and how it is turned to lie so. */
export function lyingFlat(b: Board) {
  const e = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0] as const, thin = thinAxis(b);
  // Thin across (a side): a quarter turn about z lays it down, its height along x. Thin front to back (a back, a
  // door): a quarter turn about x, its height going back. Thin upright (a shelf): it already lies flat.
  const [w, t, d] = thin === 'x' ? [e[1], e[0], e[2]] : thin === 'z' ? [e[0], e[2], e[1]] : [e[0], e[1], e[2]];
  const spin = d > w;
  return { lie: thin === 'x' ? 'z' as const : thin === 'z' ? 'x' as const : null, spin, size: (spin ? [d, t, w] : [w, t, d]) as Vec3 };
}

export function stagingLayout(piece: MakePiece, floor = 0): Staged[] {
  const order = piece.steps.flatMap(s => s.boards), out: Staged[] = piece.boards.map(() => ({ at: [0, 0, 0], lie: null, spin: false, size: [0, 0, 0] }));
  const span = Math.max(piece.size.w * 1.6, 240), x0 = piece.size.w / 2 - span / 2;
  let x = x0, z = piece.size.d + FRONT, row = 0;
  for (const i of order) {
    const flat = lyingFlat(piece.boards[i]!), [w, t, d] = flat.size;
    if (x > x0 && x + w > x0 + span) { x = x0; z += row + GAP; row = 0; }
    out[i] = { ...flat, at: [x + w / 2, floor + t / 2, z + d / 2] };
    x += w + GAP; row = Math.max(row, d);
  }
  return out;
}

/** A direction of a board as it stands built, turned as the board lies flat: a quarter turn about x takes y to z and
 * z down, one about z takes x up, and the spin about y takes z to x. */
export function lyingDir(staged: Staged, v: Vec3): Vec3 {
  let [x, y, z] = v;
  if (staged.lie === 'x') [y, z] = [-z, y];
  else if (staged.lie === 'z') [x, y] = [-y, x];
  if (staged.spin) [x, z] = [z, -x];
  return [x, y, z];
}
/** Where a point of a board (in the piece's frame, as it stands built) is while the board waits lying flat. */
export function lyingPoint(board: Board, staged: Staged, p: Vec3): Vec3 {
  const v = lyingDir(staged, [p[0] - (board.x0 + board.x1) / 2, p[1] - (board.y0 + board.y1) / 2, p[2] - (board.z0 + board.z1) / 2]);
  return [staged.at[0] + v[0], staged.at[1] + v[1], staged.at[2] + v[2]];
}
