import type { Board } from '../drawings/cabinet-boards';
import type { Construction } from './make-construction';
import { thinAxis, type Vec3 } from './make-measures';

/**
 * How the boards of a piece hold together: every place one board's edge meets another board's face, and what joins
 * them there. Centimetres in the piece's frame; hole sizes in millimetres, as hardware is sold.
 */

export type Axis = 0 | 1 | 2;
/** What is drilled. */
export type HoleKind = 'connector' | 'pilot' | 'dowel' | 'cam' | 'bolt' | 'screw' | 'cup' | 'plate' | 'runner' | 'pin' | 'handle';
/** One hole: in which board, where its mouth is, which way the drill goes in, how wide and deep (0: right through). */
export interface Hole {
  readonly board: number;
  readonly kind: HoleKind;
  readonly at: Vec3;
  readonly axis: Axis;
  readonly sign: 1 | -1;
  readonly d: number;
  readonly depth: number;
  /** The fitting it is drilled for, by its place in the fitting list it was made with. */
  readonly of?: number | undefined;
}
/** Bought hardware, where it goes and the boards it joins or sits on. */
export type FittingKind = 'confirmat' | 'dowel' | 'cam' | 'screw' | 'nail' | 'pin' | 'hinge' | 'plate' | 'runner' | 'handle' | 'rail' | 'support' | 'leg' | 'hanger'
  | 'bracket';
export interface Fitting {
  readonly kind: FittingKind;
  readonly at: Vec3;
  readonly axis: Axis;
  readonly boards: readonly number[];
  /** Its size as sold, millimetres ("7 × 50", "550"); absent when it has one size. */
  readonly size?: string;
}
/** Where one board's edge meets another's face. */
export interface Joint { readonly face: number; readonly edge: number; readonly axis: Axis; readonly plane: number; readonly side: 1 | -1 }
/** A groove cut in a board for the back to slide into: the rectangle on its face, in the piece's frame. */
export interface Groove { readonly board: number; readonly lo: Vec3; readonly hi: Vec3 }

const EPS = .05, AX = { x: 0, y: 1, z: 2 } as const;
export const lo = (b: Board): Vec3 => [b.x0, b.y0, b.z0];
export const hi = (b: Board): Vec3 => [b.x1, b.y1, b.z1];
const thin = (b: Board) => AX[thinAxis(b)];
/** A board set at a slope (the top under a sloped ceiling): its box is not its shape, so it is joined by hand. */
export const isTilted = (b: Board) => Math.min(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0) > b.cut.thickness + .05;
const isPanel = (b: Board) => b.stock !== 'door' && b.stock !== 'front' && b.stock !== 'back' && b.note !== 'adjustable' && !isTilted(b);

/** Every place a board's edge meets another board's face (one sits on, against or between the other). */
export function findJoints(boards: readonly Board[]): Joint[] {
  const out: Joint[] = [];
  boards.forEach((A, a) => {
    if (!isPanel(A)) return;
    const ta = thin(A);
    boards.forEach((B, b) => {
      if (a === b || !isPanel(B) || thin(B) === ta) return;
      const other = ([0, 1, 2] as Axis[]).filter(k => k !== ta);
      if (other.some(k => Math.min(hi(A)[k], hi(B)[k]) - Math.max(lo(A)[k], lo(B)[k]) < .5)) return;
      if (Math.abs(lo(B)[ta] - hi(A)[ta]) < EPS) out.push({ face: a, edge: b, axis: ta, plane: hi(A)[ta], side: 1 });
      else if (Math.abs(hi(B)[ta] - lo(A)[ta]) < EPS) out.push({ face: a, edge: b, axis: ta, plane: lo(A)[ta], side: -1 });
    });
  });
  return out;
}

/** Where connectors go along a joint `length` long: 5 cm in from each end, and between them no more than 30 cm apart
 * (a short joint takes one in its middle). Centimetres from the joint's start. */
export function connectorStations(length: number): number[] {
  if (length < 12) return [length / 2];
  const margin = Math.min(5, length / 4), span = length - 2 * margin, gaps = Math.max(1, Math.ceil(span / 30));
  return Array.from({ length: gaps + 1 }, (_, k) => margin + span * k / gaps);
}

/**
 * The connectors at every joint and the holes they need. Carcass joints follow the piece's joint system: a confirmat
 * through the face board into the edge board's end; a cam in the edge board's face with its bolt in the face board; or
 * dowels glued into both. Plinth frames are screwed. The edge board's end takes a pilot hole on the screw's line.
 */
export function jointFittings(boards: readonly Board[], joints: readonly Joint[], construction: Construction) {
  const holes: Hole[] = [], fittings: Fitting[] = [];
  // A board joined from both faces at one place (shelves level either side of a partition): the second joint's
  // connectors move one System 32 step along, so they never meet the first ones inside the board.
  const clear = (board: number, p: Vec3, axis: Axis) => !holes.some(h => h.board === board && h.axis === axis
    && Math.hypot(...([0, 1, 2] as Axis[]).filter(k => k !== axis).map(k => h.at[k] - p[k])) < 1.2);
  for (const j of joints) {
    const A = boards[j.face]!, B = boards[j.edge]!, tb = thin(B), run = ([0, 1, 2] as Axis[]).find(k => k !== j.axis && k !== tb)!;
    const r0 = Math.max(lo(A)[run], lo(B)[run]), r1 = Math.min(hi(A)[run], hi(B)[run]), across = (lo(B)[tb] + hi(B)[tb]) / 2;
    const plinth = A.stock === 'plinth' || B.stock === 'plinth', system = plinth ? 'screw' : construction.joints;
    for (const station of connectorStations(r1 - r0)) {
      const p = [0, 0, 0] as [number, number, number];
      p[j.axis] = j.plane; p[tb] = across; p[run] = r0 + station;
      if (!clear(j.face, p, j.axis)) p[run] += station + 3.2 <= r1 - r0 - 2 ? 3.2 : -3.2;
      const outer = [...p] as [number, number, number];
      outer[j.axis] = j.side > 0 ? lo(A)[j.axis] : hi(A)[j.axis];
      const into = j.side as 1 | -1, back = -j.side as 1 | -1;
      if (system === 'confirmat' || system === 'screw') {
        holes.push({ board: j.face, kind: system === 'screw' ? 'screw' : 'connector', at: outer, axis: j.axis, sign: into, d: system === 'screw' ? 4 : 7, depth: 0, of: fittings.length },
          { board: j.edge, kind: 'pilot', at: p, axis: j.axis, sign: into, d: system === 'screw' ? 2.5 : 5, depth: system === 'screw' ? 30 : 45, of: fittings.length });
        fittings.push({ kind: system === 'screw' ? 'screw' : 'confirmat', at: p, axis: j.axis, boards: [j.face, j.edge], size: system === 'screw' ? '4 × 40' : '7 × 50' });
      } else if (system === 'dowel') {
        holes.push({ board: j.face, kind: 'dowel', at: p, axis: j.axis, sign: back, d: 8, depth: 12, of: fittings.length },
          { board: j.edge, kind: 'dowel', at: p, axis: j.axis, sign: into, d: 8, depth: 25, of: fittings.length });
        fittings.push({ kind: 'dowel', at: p, axis: j.axis, boards: [j.face, j.edge], size: '8 × 35' });
      } else {
        // The cam sits in the edge board's inner face 34 mm from the joint; its bolt is screwed into the face board.
        const cam = [...p] as [number, number, number];
        cam[j.axis] = j.plane + j.side * 3.4; cam[tb] = hi(B)[tb];
        holes.push({ board: j.face, kind: 'bolt', at: p, axis: j.axis, sign: back, d: 5, depth: 11, of: fittings.length },
          { board: j.edge, kind: 'pilot', at: p, axis: j.axis, sign: into, d: 8, depth: 34, of: fittings.length },
          { board: j.edge, kind: 'cam', at: cam, axis: tb, sign: -1, d: 15, depth: 12.5, of: fittings.length });
        fittings.push({ kind: 'cam', at: p, axis: j.axis, boards: [j.face, j.edge], size: '15 mm' });
      }
    }
  }
  return { holes, fittings };
}

/** The back: nailed into the boards around it every 15 cm, or slid into a groove cut in each of them. */
export function backFixing(boards: readonly Board[], construction: Construction) {
  const fittings: Fitting[] = [], grooves: Groove[] = [];
  boards.forEach((back, k) => {
    if (back.stock !== 'back') return;
    boards.forEach((b, i) => {
      if (i === k || !isPanel(b) || b.stock === 'plinth') return;
      // A board the back stands against, beside or on: their boxes touch.
      const touching = ([0, 1, 2] as Axis[]).every(a => Math.min(hi(back)[a], hi(b)[a]) - Math.max(lo(back)[a], lo(b)[a]) > -EPS);
      if (!touching) return;
      const pick = (f: (p: number, q: number) => number, a: Axis) => f(f === Math.max ? lo(back)[a] : hi(back)[a], f === Math.max ? lo(b)[a] : hi(b)[a]);
      const glo: Vec3 = [pick(Math.max, 0), pick(Math.max, 1), pick(Math.max, 2)], ghi: Vec3 = [pick(Math.min, 0), pick(Math.min, 1), pick(Math.min, 2)];
      if (construction.back === 'grooved') { grooves.push({ board: i, lo: glo, hi: ghi }); return; }
      const run = ([0, 1] as Axis[]).reduce((m, a) => ghi[a] - glo[a] > ghi[m] - glo[m] ? a : m, 0 as Axis);
      const length = ghi[run] - glo[run];
      for (let s = 7.5; s < length; s += 15) {
        const at = [(glo[0] + ghi[0]) / 2, (glo[1] + ghi[1]) / 2, back.z0] as [number, number, number];
        at[run] = glo[run] + s;
        fittings.push({ kind: 'nail', at, axis: 2, boards: [k, i], size: '1.6 × 20' });
      }
    });
  });
  return { fittings, grooves };
}
