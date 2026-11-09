import type { CargoPullout } from '../kitchen/cargo-pullout';
import {
  BOLT_ENTRY,
  CAM_ENTRY,
  CONFIRMAT_ENTRY,
  DOWEL_ENTRY,
  NAIL_ENTRY,
  SCREW_ENTRY,
} from '../hardware/hardware-registry';
import { boardPolygon, clipPolygon, type Point } from './back-construction';
import type { Board } from '../drawings/cabinet-boards';
import { boreIsClear, meantToMeet } from './bore-clearance';
import type { Construction, JointSystem } from './make-construction';
import { heightsAt, thinAxis, tiltOf, type Vec3 } from './make-measures';

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
export type FittingKind = 'confirmat' | 'dowel' | 'cam' | 'bolt' | 'screw' | 'nail' | 'pin' | 'hinge' | 'plate' | 'runner' | 'handle' | 'rail' | 'support' | 'leg' | 'hanger'
  | 'bracket' | 'drawerLock';
export interface Fitting {
  readonly cargo?: CargoPullout;
  /** Installation purpose separates drawer and cargo hardware from structural cabinet connections. */
  readonly purpose?: 'runner-mount' | 'drawer-front' | 'front-fixing' | 'cargo-lock'
    /** A drawer box's own joints, in the order it goes together: bolts into the front, sides, back; then the locks. */
    | 'box-front' | 'box-sides' | 'box-back' | 'drawer-plate' | 'drawer-lock';
  /** One purchased runner pair, with both stationary and moving attachment boards. */
  readonly runner?: { readonly moving: readonly number[]; readonly fixed: readonly number[] };
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
export interface Groove { readonly board: number; readonly lo: Vec3; readonly hi: Vec3; readonly outline?: readonly Point[]; readonly kind?: 'rebate' | 'groove' }

const EPS = .05, AX = { x: 0, y: 1, z: 2 } as const;
export const lo = (b: Board): Vec3 => [b.x0, b.y0, b.z0];
export const hi = (b: Board): Vec3 => [b.x1, b.y1, b.z1];
const thin = (b: Board) => AX[thinAxis(b)];
/** A board set at a slope (the top under a sloped ceiling): its box is not its shape, so it is screwed down onto the
 * uprights under it (`slopeFittings`) rather than joined like a square board. */
export const isTilted = (b: Board) => tiltOf(b) !== 0;
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

const CONFIRMAT_FACE = CONFIRMAT_ENTRY.drilling[0]!, CONFIRMAT_EDGE = CONFIRMAT_ENTRY.drilling[1]!;
const SCREW_FACE = SCREW_ENTRY.drilling[0]!, SCREW_EDGE = SCREW_ENTRY.drilling[1]!;
const DOWEL_FACE = DOWEL_ENTRY.drilling[0]!, DOWEL_EDGE = DOWEL_ENTRY.drilling[1]!;
const SHORT_DOWEL_FACE = DOWEL_ENTRY.drilling[2]!, SHORT_DOWEL_EDGE = DOWEL_ENTRY.drilling[3]!;
const BOLT_HOLE = BOLT_ENTRY.drilling[0]!;
const CAM_HOLE = CAM_ENTRY.drilling[0]!, CAM_EDGE = CAM_ENTRY.drilling[1]!;
/** A joint shorter than this takes one connector in its middle: there is no room for two a System 32 step apart with
 * board left round each. From it on a joint takes at least two, so the boards cannot turn about one. */
const CONNECTOR_MIN_DUAL_CM = (CONFIRMAT_ENTRY.rules.clearanceMm.endCutShort ?? 64) / 10;
const CONNECTOR_INSET_CM = (CONFIRMAT_ENTRY.rules.edgeInsetMm ?? 50) / 10;
const CONNECTOR_SPACING_CM = (CONFIRMAT_ENTRY.rules.maxSpacingMm ?? 300) / 10;
const CONNECTOR_PITCH_CM = (CONFIRMAT_ENTRY.rules.pitchMm ?? 32) / 10;
const CAM_LINE_CM = (CAM_ENTRY.rules.systemLineMm ?? 34) / 10;
const NAIL_SPACING_CM = (NAIL_ENTRY.rules.maxSpacingMm ?? 150) / 10;
const NAIL_SIZE = NAIL_ENTRY.display.listLine.defaultSpec;
/** A connector stays at least this far from the end of its joint when it steps aside, centimetres. */
const CONNECTOR_END_CM = 1.6;

/** Where connectors go along a joint `length` long: 5 cm in from each end (a quarter of a short joint), and between
 * them no more than 30 cm apart; a joint under 64 mm takes one in its middle. Centimetres from the joint's start. */
export function connectorStations(length: number): number[] {
  if (length < CONNECTOR_MIN_DUAL_CM) return [length / 2];
  const margin = Math.min(CONNECTOR_INSET_CM, length / 4), span = length - 2 * margin, gaps = Math.max(1, Math.ceil(span / CONNECTOR_SPACING_CM));
  return Array.from({ length: gaps + 1 }, (_, k) => margin + span * k / gaps);
}

/** The steps a connector tries along its joint when its place is taken: its own, then one System 32 step either way,
 * then two, three. */
const STEPS_ASIDE = [0, 1, -1, 2, -2, 3, -3].map(k => k * CONNECTOR_PITCH_CM);

/**
 * The connectors at every joint and the holes they need. Carcass joints follow the piece's joint system: a confirmat
 * through the face board into the edge board's end; a cam in the edge board's face with its bolt in the face board; or
 * dowels glued into both. Plinth frames are screwed. The edge board's end takes a pilot hole on the screw's line.
 *
 * No connector is drilled into another: one whose holes would come within 2 mm of a hole already set out, in either
 * board and in any direction (bore-clearance.ts), steps along its joint a System 32 pitch at a time until it is clear.
 * So shelves level either side of a partition, a divider standing near the end of a shelf and a plinth rail screwed
 * from its face and into its end all keep their connectors apart. `system` chooses another connector for one joint.
 */
export function jointFittings(boards: readonly Board[], joints: readonly Joint[], construction: Construction,
  system: (joint: Joint) => JointSystem | undefined = () => undefined) {
  const holes: Hole[] = [], fittings: Fitting[] = [];
  for (const j of joints) {
    const A = boards[j.face]!, B = boards[j.edge]!, tb = thin(B), run = ([0, 1, 2] as Axis[]).find(k => k !== j.axis && k !== tb)!;
    const r0 = Math.max(lo(A)[run], lo(B)[run]), r1 = Math.min(hi(A)[run], hi(B)[run]), across = (Math.max(lo(A)[tb], lo(B)[tb]) + Math.min(hi(A)[tb], hi(B)[tb])) / 2;
    const plinth = A.stock === 'plinth' || B.stock === 'plinth', chosen = plinth ? 'screw' : system(j) ?? construction.joints;
    for (const station of connectorStations(r1 - r0)) {
      // The connector at `at` along the joint: its holes and fittings, numbered from `first`.
      const build = (at: number, first: number): { holes: Hole[]; fittings: Fitting[] } => {
        const p = [0, 0, 0] as [number, number, number];
        p[j.axis] = j.plane; p[tb] = across; p[run] = at;
        const outer = [...p] as [number, number, number];
        outer[j.axis] = j.side > 0 ? lo(A)[j.axis] : hi(A)[j.axis];
        const into = j.side as 1 | -1, back = -j.side as 1 | -1;
        let system = chosen, shortDowel = false;
        // A shelf just under a rising roof may meet the inner face above the outer face.
        // Use a short blind dowel from inside, with its axis lower in the shelf; never drill through air.
        if (j.axis === 0 && tb === 1 && A.outline && outer[1] + .35 > heightsAt(A, outer[0])[1]) {
          system = 'dowel'; shortDowel = true;
          const endX = j.plane - j.side, roof = Math.min(heightsAt(A,j.plane)[1],heightsAt(A,endX)[1]);
          p[1] = Math.min(across, roof - .4);
        }
        if (system === 'confirmat' || system === 'screw') {
          const faceHole = system === 'screw' ? SCREW_FACE : CONFIRMAT_FACE;
          const edgeHole = system === 'screw' ? SCREW_EDGE : CONFIRMAT_EDGE;
          const size = system === 'screw' ? SCREW_ENTRY.display.listLine.defaultSpec : CONFIRMAT_ENTRY.display.listLine.defaultSpec;
          return { holes: [{ board: j.face, kind: system === 'screw' ? 'screw' : 'connector', at: outer, axis: j.axis, sign: into, d: faceHole.dMm, depth: faceHole.depthMm, of: first },
            { board: j.edge, kind: 'pilot', at: p, axis: j.axis, sign: into, d: edgeHole.dMm, depth: edgeHole.depthMm, of: first }],
            fittings: [{ kind: system === 'screw' ? 'screw' : 'confirmat', at: p, axis: j.axis, boards: [j.face, j.edge], size }] };
        }
        if (system === 'dowel') {
          const faceHole = shortDowel ? SHORT_DOWEL_FACE : DOWEL_FACE;
          const edgeHole = shortDowel ? SHORT_DOWEL_EDGE : DOWEL_EDGE;
          const size = shortDowel ? (DOWEL_ENTRY.variants?.[1]?.sizeLabel ?? '6 × 30') : DOWEL_ENTRY.display.listLine.defaultSpec;
          return { holes: [{ board: j.face, kind: 'dowel', at: p, axis: j.axis, sign: back, d: faceHole.dMm, depth: faceHole.depthMm, of: first },
            { board: j.edge, kind: 'dowel', at: p, axis: j.axis, sign: into, d: edgeHole.dMm, depth: edgeHole.depthMm, of: first }],
            fittings: [{ kind: 'dowel', at: p, axis: j.axis, boards: [j.face, j.edge], size }] };
        }
        // The bolt is screwed into the face board; the edge board goes on over it (its head in a pilot hole 34 mm into
        // the board's end), and the cam, set in the edge board's inner face 34 mm from the joint, is turned to grip it.
        const cam = [...p] as [number, number, number];
        cam[j.axis] = j.plane + j.side * CAM_LINE_CM; cam[tb] = hi(B)[tb];
        return { holes: [{ board: j.face, kind: 'bolt', at: p, axis: j.axis, sign: back, d: BOLT_HOLE.dMm, depth: BOLT_HOLE.depthMm, of: first },
          { board: j.edge, kind: 'pilot', at: p, axis: j.axis, sign: into, d: CAM_EDGE.dMm, depth: CAM_EDGE.depthMm, of: first + 1 },
          { board: j.edge, kind: 'cam', at: cam, axis: tb, sign: -1, d: CAM_HOLE.dMm, depth: CAM_HOLE.depthMm, of: first + 1 }],
          fittings: [{ kind: 'bolt', at: p, axis: j.axis, boards: [j.face, j.edge], size: BOLT_ENTRY.display.listLine.defaultSpec },
            { kind: 'cam', at: cam, axis: tb, boards: [j.face, j.edge], size: CAM_ENTRY.display.listLine.defaultSpec }] };
      };
      const clear = (made: { holes: Hole[] }) => made.holes.every(h => boreIsClear(boards, holes, h, o => meantToMeet(o, h)));
      const inJoint = (at: number) => at >= r0 + Math.min(CONNECTOR_END_CM, (r1 - r0) / 2) - 1e-9 && at <= r1 - Math.min(CONNECTOR_END_CM, (r1 - r0) / 2) + 1e-9;
      const tries = STEPS_ASIDE.map(step => r0 + station + step).filter(inJoint).map(at => build(at, fittings.length));
      // Its own place when no step is clear: the drilling check then names the two holes, and nothing is issued.
      const made = tries.find(clear) ?? build(r0 + station, fittings.length);
      holes.push(...made.holes); fittings.push(...made.fittings);
    }
  }
  slopeFittings(boards, holes, fittings);
  return { holes, fittings };
}

/** The lowest and highest point of an outline straight up from `x`. */
function across(outline: readonly { x: number; y: number }[], x: number): [number, number] {
  const ys: number[] = [];
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length]!;
    if ((p.x - x) * (q.x - x) > 0 || p.x === q.x) { if (Math.abs(p.x - x) < EPS) ys.push(p.y); return; }
    ys.push(p.y + (q.y - p.y) * (x - p.x) / (q.x - p.x));
  });
  return [Math.min(...ys), Math.max(...ys)];
}
/**
 * A top set at a slope, screwed down into each side and partition standing under it: straight down through the top in
 * the upright's own plane, so the screw stays in the upright's thickness however steep the slope. Connector screws
 * whatever the joint system: a cam or a dowel cannot be set square to a sloped edge.
 */
function slopeFittings(boards: readonly Board[], holes: Hole[], fittings: Fitting[]) {
  boards.forEach((top, t) => {
    if (!top.outline || !isTilted(top) || top.stock !== 'carcass') return;
    boards.forEach((up, u) => {
      if (!isPanel(up) || thin(up) !== 0 || up.stock === 'plinth') return;
      const x = (up.x0 + up.x1) / 2, r0 = Math.max(top.z0, up.z0), r1 = Math.min(top.z1, up.z1);
      if (x < top.x0 || x > top.x1 || r1 - r0 < .5) return;
      const [under, over] = across(top.outline!, x), end = up.outline ? across(up.outline, x)[1] : up.y1;
      if (Math.abs(end - under) > .3) return;
      for (const station of connectorStations(r1 - r0)) {
        const pair = (z: number): Hole[] => [
          { board: t, kind: 'connector', at: [x, over, z], axis: 1, sign: -1, d: CONFIRMAT_FACE.dMm, depth: CONFIRMAT_FACE.depthMm, of: fittings.length },
          { board: u, kind: 'pilot', at: [x, under, z], axis: 1, sign: -1, d: CONFIRMAT_EDGE.dMm, depth: CONFIRMAT_EDGE.depthMm, of: fittings.length }];
        // Clear of the upright's other connectors (a shelf screwed into it just under the top), a System 32 step at a time.
        const tries = STEPS_ASIDE.map(step => r0 + station + step).filter(z => z >= r0 + CONNECTOR_END_CM && z <= r1 - CONNECTOR_END_CM);
        const z = tries.find(q => pair(q).every(h => boreIsClear(boards, holes, h))) ?? r0 + station;
        holes.push(...pair(z));
        fittings.push({ kind: 'confirmat', at: [x, under, z], axis: 1, boards: [t, u], size: CONFIRMAT_ENTRY.display.listLine.defaultSpec });
      }
    });
  });
}

/** The back: nailed into the boards around it every 15 cm, or slid into a groove cut in each of them. */
export function backFixing(boards: readonly Board[], construction: Construction) {
  const fittings: Fitting[] = [], grooves: Groove[] = [];
  boards.forEach((back, k) => {
    if (back.stock !== 'back') return;
    if (back.note !== 'drawer box') {
      boards.forEach((b,i) => {
        if (b.stock !== 'carcass' || b.note === 'drawer box' || i === k) return;
        const polygon = clipPolygon(boardPolygon(back), boardPolygon(b));
        const area = Math.abs(polygon.reduce((s,p,j) => { const q=polygon[(j+1)%polygon.length]!; return s+p.x*q.y-q.x*p.y; },0))/2;
        if (area < 1e-9) return;
        const x0=Math.min(...polygon.map(p=>p.x)),x1=Math.max(...polygon.map(p=>p.x));
        const y0=Math.min(...polygon.map(p=>p.y)),y1=Math.max(...polygon.map(p=>p.y));
        const z0=Math.max(back.z0,b.z0),z1=Math.min(back.z1,b.z1);
        if (z1-z0>1e-9) grooves.push({board:i,lo:[x0,y0,z0],hi:[x1,y1,z1],outline:polygon,kind:construction.back==='grooved'?'groove':'rebate'});
        if (construction.back === 'grooved' || Math.abs(b.z0-back.z1)>1e-9 && z1-z0<=0 || b.z1-back.z1<1.4) return;
        const run = x1-x0 > y1-y0 ? 'x' : 'y', other=run==='x'?'y':'x', low=run==='x'?x0:y0, high=run==='x'?x1:y1;
        const count=Math.max(1,Math.ceil((high-low)/NAIL_SPACING_CM));
        for(let n=0;n<count;n++) {
          const atRun=low+(high-low)*(n+.5)/count, values:number[]=[];
          polygon.forEach((p,j)=>{const q=polygon[(j+1)%polygon.length]!;
            if(p[run]!==q[run] && atRun>=Math.min(p[run],q[run]) && atRun<=Math.max(p[run],q[run]))
              values.push(p[other]+(q[other]-p[other])*(atRun-p[run])/(q[run]-p[run]));
          });
          const mid=(Math.min(...values)+Math.max(...values))/2;
          fittings.push({kind:'nail',at:[run==='x'?atRun:mid,run==='y'?atRun:mid,back.z0],axis:2,boards:[k,i],size:NAIL_SIZE});
        }
      });
      return;
    }
    // A drawer bottom is not fixed: it is captured in the grooves of its box (drawer-box.ts).
    if (back.note === 'drawer box') return;
    boards.forEach((b, i) => {
      if (i === k || !isPanel(b) || b.stock === 'plinth') return;
      // A board the back stands against, beside or on: their boxes touch.
      const touching = ([0, 1, 2] as Axis[]).every(a => Math.min(hi(back)[a], hi(b)[a]) - Math.max(lo(back)[a], lo(b)[a]) > -EPS);
      if (!touching) return;
      const pick = (f: (p: number, q: number) => number, a: Axis) => f(f === Math.max ? lo(back)[a] : hi(back)[a], f === Math.max ? lo(b)[a] : hi(b)[a]);
      const glo: Vec3 = [pick(Math.max, 0), pick(Math.max, 1), pick(Math.max, 2)], ghi: Vec3 = [pick(Math.min, 0), pick(Math.min, 1), pick(Math.min, 2)];
      if (construction.back === 'grooved' && back.note !== 'drawer box') { grooves.push({ board: i, lo: glo, hi: ghi }); return; }
      const axis: Axis = back.note === 'drawer box' ? 1 : 2;
      const run = ([0, 1, 2] as Axis[]).filter(a => a !== axis).reduce((m, a) => ghi[a] - glo[a] > ghi[m] - glo[m] ? a : m, 0 as Axis);
      const length = ghi[run] - glo[run];
      for (let s = NAIL_SPACING_CM / 2; s < length; s += NAIL_SPACING_CM) {
        const at = [(glo[0] + ghi[0]) / 2, (glo[1] + ghi[1]) / 2, (glo[2] + ghi[2]) / 2] as [number, number, number];
        at[axis] = lo(back)[axis]; at[run] = glo[run] + s;
        fittings.push({ kind: 'nail', at, axis, boards: [k, i], size: NAIL_SIZE });
      }
    });
  });
  return { fittings, grooves };
}
