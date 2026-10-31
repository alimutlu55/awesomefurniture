import type { Board } from '../../domain/drawings/cabinet-boards';
import type { Vec3 } from '../../domain/make/make-measures';

/** Where Make looks from: turned about the vertical (yaw) and tipped down (pitch), radians. */
export interface MakeView { readonly yaw: number; readonly pitch: number }
export const MAKE_VIEWS = {
  iso: { yaw: -.62, pitch: .42 },
  front: { yaw: 0, pitch: 0 },
  side: { yaw: -Math.PI / 2, pitch: 0 },
  top: { yaw: 0, pitch: Math.PI / 2 },
} as const satisfies Record<string, MakeView>;
export type MakeViewName = keyof typeof MAKE_VIEWS;

/** A point of the piece (centimetres) on the drawing: x right, y down, and its depth towards the viewer. */
export type Projected = [number, number, number];
export function projector(view: MakeView) {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  return (p: Vec3): Projected => {
    const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
    return [x1, -(p[1] * cp - z1 * sp), p[1] * sp + z1 * cp];
  };
}
/** The direction from the piece towards the viewer, in the piece's frame. */
export const towardViewer = (view: MakeView): Vec3 =>
  [-Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch)];

/** A face of a board: its corners, which way it faces, and how it is shaded (top, front or side). */
export interface Face { readonly points: readonly Vec3[]; readonly normal: Vec3; readonly shade: 'ft' | 'ff' | 'fs' }

/** The board's outline across its width and height: its sloped outline, else its box, turned anticlockwise. */
function outline(b: Board): { x: number; y: number }[] {
  const pts = b.outline ? b.outline.map(p => ({ x: p.x, y: p.y }))
    : [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }];
  const area = pts.reduce((s, p, k) => { const q = pts[(k + 1) % pts.length]!; return s + p.x * q.y - q.x * p.y; }, 0);
  return area < 0 ? pts.reverse() : pts;
}
const shadeOf = (n: Vec3): Face['shade'] => Math.abs(n[1]) >= Math.abs(n[0]) && Math.abs(n[1]) >= Math.abs(n[2]) ? 'ft' : Math.abs(n[2]) >= Math.abs(n[0]) ? 'ff' : 'fs';

/** Every face of a board moved by `offset`: its outline at the front and the back, and a face along each edge. */
export function boardFaces(b: Board, offset: Vec3): Face[] {
  const pts = outline(b), [dx, dy, dz] = offset, at = (p: { x: number; y: number }, z: number): Vec3 => [p.x + dx, p.y + dy, z + dz];
  const faces: Face[] = [
    { points: pts.map(p => at(p, b.z1)), normal: [0, 0, 1], shade: 'ff' },
    { points: pts.map(p => at(p, b.z0)).reverse(), normal: [0, 0, -1], shade: 'ff' },
  ];
  pts.forEach((p, k) => {
    const q = pts[(k + 1) % pts.length]!, ex = q.x - p.x, ey = q.y - p.y, len = Math.hypot(ex, ey);
    if (len < 1e-6) return;
    const normal: Vec3 = [ey / len, -ex / len, 0];
    faces.push({ points: [at(p, b.z0), at(q, b.z0), at(q, b.z1), at(p, b.z1)], normal, shade: shadeOf(normal) });
  });
  return faces;
}

/** The box a board fills once moved, for ordering. */
export interface Bounds { readonly lo: Vec3; readonly hi: Vec3 }
export const boundsOf = (b: Board, offset: Vec3): Bounds =>
  ({ lo: [b.x0 + offset[0], b.y0 + offset[1], b.z0 + offset[2]], hi: [b.x1 + offset[0], b.y1 + offset[1], b.z1 + offset[2]] });

/**
 * The order to paint boxes in, farthest first. Two boards that do not overlap are apart along some axis; the one on the
 * viewer's side of that gap is nearer. Pairs whose drawings do not overlap need no order. What is left in a cycle (rare,
 * boards leaning on each other) is settled by the depth of their centres.
 */
export function paintOrder(boxes: readonly Bounds[], view: MakeView, screen: readonly { x0: number; x1: number; y0: number; y1: number }[]): number[] {
  const v = towardViewer(view), n = boxes.length, after: number[][] = boxes.map(() => []), waiting = new Array<number>(n).fill(0);
  const centreDepth = boxes.map(b => (b.lo[0] + b.hi[0]) * v[0] + (b.lo[1] + b.hi[1]) * v[1] + (b.lo[2] + b.hi[2]) * v[2]);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const s = screen[i]!, t = screen[j]!;
    if (s.x1 <= t.x0 || t.x1 <= s.x0 || s.y1 <= t.y0 || t.y1 <= s.y0) continue;
    const a = boxes[i]!, b = boxes[j]!;
    let best = 0, nearer = -1;
    for (let k = 0; k < 3; k++) {
      const weight = Math.abs(v[k]!);
      if (weight < 1e-6 || weight <= best) continue;
      if (a.hi[k]! <= b.lo[k]! + .001) { best = weight; nearer = v[k]! > 0 ? j : i; }
      else if (b.hi[k]! <= a.lo[k]! + .001) { best = weight; nearer = v[k]! > 0 ? i : j; }
    }
    if (nearer < 0) continue;
    const farther = nearer === i ? j : i;
    after[farther]!.push(nearer);
    waiting[nearer] = waiting[nearer]! + 1;
  }
  const order: number[] = [], done = new Array<boolean>(n).fill(false);
  while (order.length < n) {
    let next = -1;
    for (let i = 0; i < n; i++) if (!done[i] && waiting[i] === 0 && (next < 0 || centreDepth[i]! < centreDepth[next]!)) next = i;
    if (next < 0) for (let i = 0; i < n; i++) if (!done[i] && (next < 0 || centreDepth[i]! < centreDepth[next]!)) next = i;
    done[next] = true;
    order.push(next);
    for (const k of after[next]!) waiting[k] = waiting[k]! - 1;
  }
  return order;
}
