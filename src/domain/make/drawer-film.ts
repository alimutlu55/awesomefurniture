import type { DrawerBox } from './drawer-box';
import type { MakePiece } from './make-parts';
import type { Vec3 } from './make-measures';
import { arrivalAt, INSTALL_EACH, type Playhead, type Timeline } from './make-timeline';

/**
 * The drawers in the assembly film, as the flat-pack drawer manual shows them:
 *
 * 1. Each box is built on a soft mat on the floor in front of the piece, its front lying face down: the bottom is set in
 *    the front's groove at an angle and swung up, the sides come down over the bolts and dowels, the back is hooked over
 *    the bottom's edge and swung shut.
 * 2. With the runners on the cabinet, both runners are pulled out; each box is lifted off the mat, turned upright, its
 *    back hooked onto the runners' rear hooks with the front held up, the front lowered onto the pins, and the drawer
 *    pushed home, its runners going in with it.
 *
 * A pose is a rigid move: a turn about the x axis round a point, then where that point goes. Centimetres in the piece's
 * frame (x from its left face, y up from its floor line, z from its back); radians.
 */
export interface DrawerPose { readonly angle: number; readonly ref: Vec3; readonly at: Vec3 }

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = unit(v); return t * t * (3 - 2 * t); };

/** A direction turned `angle` about the x axis (y towards z). */
export function turnX(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}
/** A board point (as it stands built) where `pose` puts it. */
export const posePoint = (pose: DrawerPose, p: Vec3): Vec3 => add(turnX(sub(p, pose.ref), pose.angle), pose.at);
/** A direction on a board, turned as `pose` turns the board. */
export const poseDir = (pose: DrawerPose, v: Vec3): Vec3 => turnX(v, pose.angle);
/** Moved by `by`, not turned. */
export const shifted = (by: Vec3): DrawerPose => ({ angle: 0, ref: [0, 0, 0], at: by });
/** `inner`, then `outer`. */
const compose = (outer: DrawerPose, inner: DrawerPose): DrawerPose => ({ angle: outer.angle + inner.angle, ref: inner.ref, at: posePoint(outer, inner.at) });
/** Between two poses, `about` a point of the board, lifted `lift` at the middle. */
function blend(a: DrawerPose, b: DrawerPose, t: number, about: Vec3, lift = 0): DrawerPose {
  const pa = posePoint(a, about), pb = posePoint(b, about), at: Vec3 = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t + lift * Math.sin(Math.PI * t), pa[2] + (pb[2] - pa[2]) * t];
  return { angle: a.angle + (b.angle - a.angle) * t, ref: about, at };
}

/** The mat: this thick, its edge this far in front of the piece, boxes this far apart on it, rows this far apart. */
export const MAT = 1;
const MAT_FROM = 10, MAT_EDGE = 6, BENCH_GAP = 14, ROW_GAP = 10;
/** Where a box stands on the mat: `ref`, the middle of its front's outer face, at `at`, the front lying face down. */
export interface Bench { readonly at: Vec3; readonly ref: Vec3; readonly size: readonly [number, number] }
/** The mat under the boxes being built: its corners on the floor and its top. */
export interface MatArea { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number; readonly y: number }

/** Every drawer's place on the mat, in rows across the front of the piece, the way the parts are laid out. */
export function drawerBenches(piece: MakePiece, floor = 0): Bench[] {
  const span = Math.max(piece.size.w * 1.6, 240), x0 = piece.size.w / 2 - span / 2;
  let x = x0, z = piece.size.d + MAT_FROM + MAT_EDGE, row = 0;
  return (piece.drawers ?? []).map(d => {
    const f = piece.boards[d.front]!, w = f.x1 - f.x0, h = f.y1 - f.y0;
    if (x > x0 && x + w > x0 + span) { x = x0; z += row + ROW_GAP; row = 0; }
    const bench: Bench = { ref: [(f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, f.z1], at: [x + w / 2, floor + MAT, z + h / 2], size: [w, h] };
    x += w + BENCH_GAP; row = Math.max(row, h);
    return bench;
  });
}
/** The mat round the benches, or null with no drawers. */
export function matArea(piece: MakePiece, floor = 0): MatArea | null {
  const benches = drawerBenches(piece, floor);
  if (!benches.length) return null;
  const lo = (k: 0 | 2, n: 0 | 1) => Math.min(...benches.map(b => b.at[k] - b.size[n] / 2)) - MAT_EDGE;
  const hi = (k: 0 | 2, n: 0 | 1) => Math.max(...benches.map(b => b.at[k] + b.size[n] / 2)) + MAT_EDGE;
  return { x0: lo(0, 0), x1: hi(0, 0), z0: lo(2, 1), z1: hi(2, 1), y: floor + MAT };
}
/** How much deeper the floor in front of the piece must be for the mat: the parts wait beyond it. */
export function benchRoom(piece: MakePiece): number {
  const mat = matArea(piece);
  return mat ? mat.z1 - piece.size.d + ROW_GAP : 0;
}

/** Lifting a box off the mat, it rises this high over its way; it comes in this far above its runners with its front
 * held up this much (radians), hooked on at the back. */
const CARRY_LIFT = 30, HOVER = 4, FRONT_UP = .2;
/** The bottom goes into the front's groove at this angle and the back over the bottom's edge at this one (radians); a
 * side comes down onto the bolts from this far. */
const BOTTOM_IN = .6, BACK_OPEN = 1.1, SIDE_DROP = 6;

const isBoxPart = (d: DrawerBox, board: number) => board === d.bottom || board === d.back || d.sides.includes(board) || board === d.front;
/** The drawer `board` is part of (its box, or a wardrobe drawer's own front), with its place in the list. */
export function drawerOf(piece: MakePiece, board: number): { d: DrawerBox; k: number } | null {
  const k = (piece.drawers ?? []).findIndex(d => isBoxPart(d, board));
  return k < 0 ? null : { d: piece.drawers![k]!, k };
}
/** The open distance of a drawer, from its runners' motion. */
const travel = (piece: MakePiece, d: DrawerBox) => { const m = piece.motions[d.sides[0]] ?? piece.motions[d.front]; return m?.kind === 'slide' ? m.by : 30; };
/** The box's rear hook line: under the middle of the box, at its lower edge, at the back's rear face. */
function hookPoint(piece: MakePiece, d: DrawerBox): Vec3 {
  const l = piece.boards[d.sides[0]]!, r = piece.boards[d.sides[1]]!, back = piece.boards[d.back]!;
  return [(l.x0 + r.x1) / 2, l.y0, back.z0];
}
/** The middle of the box, to turn it about while it is carried. */
function boxMiddle(piece: MakePiece, d: DrawerBox): Vec3 {
  const parts = [d.front, d.back, d.bottom, ...d.sides].map(i => piece.boards[i]!);
  const lo = (k: 'x0' | 'y0' | 'z0') => Math.min(...parts.map(b => b[k])), hi = (k: 'x1' | 'y1' | 'z1') => Math.max(...parts.map(b => b[k]));
  return [(lo('x0') + hi('x1')) / 2, (lo('y0') + hi('y1')) / 2, (lo('z0') + hi('z1')) / 2];
}
/** When drawer `k` goes on its runners: [start, end] seconds, or null with no `drawers` chapter. */
export function installWindow(piece: MakePiece, tl: Timeline, k: number): readonly [number, number] | null {
  const step = piece.steps.findIndex(s => s.stage === 'drawers');
  if (step < 0) return null;
  const s = tl.steps[step]!, each = Math.min(INSTALL_EACH, (s.place[1] - s.place[0]) / Math.max(1, piece.drawers?.length ?? 1));
  return [s.place[0] + each * k, s.place[0] + each * (k + 1)];
}

/** A box board's own move while its chapter puts it on the box (in the box's frame): the bottom swung up into the front's
 * groove, a side lowered over the bolts, the back swung shut over the bottom's edge. */
function onTheBox(piece: MakePiece, tl: Timeline, ph: Playhead, d: DrawerBox, board: number): DrawerPose {
  if (tl.boardStep[board] !== ph.step) return shifted([0, 0, 0]);
  const settle = 1 - ease((arrivalAt(tl, ph, board) - .55) / .45), bottom = piece.boards[d.bottom]!, cx = (bottom.x0 + bottom.x1) / 2, cy = (bottom.y0 + bottom.y1) / 2;
  if (board === d.bottom) { const g: Vec3 = [cx, cy, bottom.z1]; return { angle: BOTTOM_IN * settle, ref: g, at: g }; }
  if (board === d.back) { const g: Vec3 = [cx, cy, bottom.z0]; return { angle: -BACK_OPEN * settle, ref: g, at: g }; }
  if (d.sides.includes(board)) return shifted([0, 0, -SIDE_DROP * settle]);
  return shifted([0, 0, 0]);
}

/**
 * Where a drawer's box board is at the playhead: on the mat (front face down) while it is built and until its turn to go
 * on, carried and hooked onto the pulled-out runners in its turn, then in the cabinet. Null for any other board, and for
 * a box once it is in (cabinet moves are drawer-installation.ts's).
 */
export function benchPose(piece: MakePiece, tl: Timeline, ph: Playhead, board: number, floor = 0): DrawerPose | null {
  const found = drawerOf(piece, board);
  if (!found) return null;
  const { d, k } = found, bench = drawerBenches(piece, floor)[k]!, window = installWindow(piece, tl, k);
  const onMat: DrawerPose = { angle: Math.PI / 2, ref: bench.ref, at: bench.at };
  if (!window || ph.t < window[0]) return compose(onMat, onTheBox(piece, tl, ph, d, board));
  if (ph.t >= window[1]) return null;
  const u = (ph.t - window[0]) / (window[1] - window[0]), hook = hookPoint(piece, d), out = travel(piece, d);
  const hover: DrawerPose = { angle: -FRONT_UP, ref: hook, at: add(hook, [0, HOVER, out]) };
  const hooked: DrawerPose = { angle: -FRONT_UP, ref: hook, at: add(hook, [0, 0, out]) };
  const down: DrawerPose = { angle: 0, ref: hook, at: add(hook, [0, 0, out]) };
  if (u < .45) return blend(onMat, hover, ease(u / .45), boxMiddle(piece, d), CARRY_LIFT);
  if (u < .6) return blend(hover, hooked, ease((u - .45) / .15), hook);
  if (u < .75) return blend(hooked, down, ease((u - .6) / .15), hook);
  return shifted([0, 0, out * (1 - ease((u - .75) / .25))]);
}

/** How far a drawer's runners are pulled out while the `drawers` chapter puts the boxes on: both pulled out at its start,
 * each pair going home with its drawer. Null outside that chapter (the runners then go with the drawer). */
export function runnerPull(piece: MakePiece, tl: Timeline, ph: Playhead, board: number): number | null {
  const found = drawerOf(piece, board), step = piece.steps.findIndex(s => s.stage === 'drawers');
  if (!found || step < 0 || ph.step !== step) return null;
  const s = tl.steps[step]!, window = installWindow(piece, tl, found.k)!, out = travel(piece, found.d);
  if (ph.t < window[0] + (window[1] - window[0]) * .75) return out * ease((ph.t - s.start) / .8);
  return out * (1 - ease((ph.t - window[0] - (window[1] - window[0]) * .75) / ((window[1] - window[0]) * .25)));
}

/** The boards a drawer's box is made of, for framing it. */
export const drawerBoards = (d: DrawerBox): number[] => [d.front, d.bottom, d.back, ...d.sides];
