import { kitchenUnit, WORKTOP, KITCHEN_PLINTH_SETBACK } from './kitchen-units';
import type { KitchenUnitKey } from './kitchen-units';
import { PLINTH } from '../wardrobe/catalog.js';

/**
 * Kitchen runs: units standing side by side along the same back line form a run, and share one worktop
 * and one plinth across it. Runs are not stored: they follow from where the units stand, so moving a unit
 * away leaves the run and pushing it back joins it again. Centimetres, scene coordinates.
 */
export interface UnitPose {
  readonly id: number | string;
  readonly x: number;
  readonly y?: number | undefined;
  readonly z: number;
  readonly angle: number;
  readonly state: { readonly w: number; readonly h: number; readonly d: number; readonly product?: 'kitchen' | undefined; readonly unit?: KitchenUnitKey | undefined };
}
export interface Pose { x: number; y: number; z: number; angle: number }
/** A slab along a run: `length` along the units' width, `depth` from `back` towards the front. */
export interface KitchenSpan {
  readonly kind: 'worktop' | 'plinth';
  /** Centre of the slab's footprint, its underside height, and the run's direction. */
  readonly x: number; readonly z: number; readonly y: number; readonly angle: number;
  readonly length: number; readonly depth: number; readonly height: number;
  readonly units: readonly (number | string)[];
}

/** Units this close (or overlapping this little) count as touching. */
export const RUN_TOLERANCE = 1;

const rad = (angle: number) => angle * Math.PI / 180;
/** Width direction (to the unit's right) and front direction of a unit at `angle`. */
export function unitAxes(angle: number) {
  const a = rad(angle);
  return { u: { x: Math.cos(a), z: -Math.sin(a) }, v: { x: Math.sin(a), z: Math.cos(a) } };
}
const along = (p: { x: number; z: number }, angle: number) => { const { u } = unitAxes(angle); return p.x * u.x + p.z * u.z; };
const across = (p: { x: number; z: number }, angle: number) => { const { v } = unitAxes(angle); return p.x * v.x + p.z * v.z; };
const toScene = (s: number, t: number, angle: number) => { const { u, v } = unitAxes(angle); return { x: u.x * s + v.x * t, z: u.z * s + v.z * t }; };
const sameAngle = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180) < .5;

export const isKitchenUnit = (c: UnitPose) => c.state.product === 'kitchen';
const onFloor = (c: UnitPose) => Math.abs(c.y || 0) < .5;
/** Where a unit's back is, measured towards the front of units at `angle`. */
const backLine = (c: UnitPose, angle: number) => across(c, angle) - c.state.d / 2;

/** Groups of units that stand side by side, each sorted from left to right. */
export function kitchenRuns(units: readonly UnitPose[], joins: (a: UnitPose, b: UnitPose) => boolean = () => true): UnitPose[][] {
  const runs: UnitPose[][] = [];
  const pending = units.filter(isKitchenUnit).slice();
  while (pending.length) {
    const seed = pending.shift()!, angle = seed.angle, back = backLine(seed, angle);
    const line = [seed, ...pending.filter(c => sameAngle(c.angle, angle) && Math.abs(backLine(c, angle) - back) < RUN_TOLERANCE)];
    line.sort((a, b) => along(a, angle) - along(b, angle));
    let run: UnitPose[] = [];
    for (const c of line) {
      const prev = run[run.length - 1];
      const touching = prev && Math.abs((along(c, angle) - c.state.w / 2) - (along(prev, angle) + prev.state.w / 2)) <= RUN_TOLERANCE && joins(prev, c);
      if (prev && !touching) { runs.push(run); run = []; }
      run.push(c);
    }
    runs.push(run);
    for (const c of line) { const at = pending.indexOf(c); if (at >= 0) pending.splice(at, 1); }
  }
  return runs.filter(r => r.length);
}

function span(kind: KitchenSpan['kind'], run: readonly UnitPose[], y: number, height: number, back: number, depth: number): KitchenSpan {
  const angle = run[0]!.angle, left = Math.min(...run.map(c => along(c, angle) - c.state.w / 2)), right = Math.max(...run.map(c => along(c, angle) + c.state.w / 2));
  const centre = toScene((left + right) / 2, back + depth / 2, angle);
  return { kind, ...centre, y, angle, length: right - left, depth, height, units: run.map(c => c.id) };
}

/** One worktop over each row of base units that touch at the same height, and one plinth under each row of
 * floor units that touch, set back from the shallowest front. */
export function kitchenSpans(units: readonly UnitPose[]): KitchenSpan[] {
  const spans: KitchenSpan[] = [];
  const top = (c: UnitPose) => (c.y || 0) + c.state.h;
  const worktop = units.filter(c => isKitchenUnit(c) && kitchenUnit(c.state.unit).worktop && onFloor(c));
  for (const run of kitchenRuns(worktop, (a, b) => Math.abs(top(a) - top(b)) < .5)) {
    const angle = run[0]!.angle, back = Math.min(...run.map(c => backLine(c, angle)));
    spans.push(span('worktop', run, top(run[0]!), WORKTOP.thickness, back, Math.max(...run.map(c => backLine(c, angle) - back + c.state.d)) + WORKTOP.overhang));
  }
  const floor = units.filter(c => isKitchenUnit(c) && kitchenUnit(c.state.unit).plinth && onFloor(c));
  for (const run of kitchenRuns(floor)) {
    const angle = run[0]!.angle, back = Math.min(...run.map(c => backLine(c, angle)));
    spans.push(span('plinth', run, 0, PLINTH, back, Math.min(...run.map(c => backLine(c, angle) - back + c.state.d)) - KITCHEN_PLINTH_SETBACK));
  }
  return spans;
}

/** Where a unit `w` wide and `d` deep stands right beside `anchor` (side 1: on its right, -1: on its left),
 * backs in line, at `y`. */
export function besidePose(anchor: UnitPose, w: number, d: number, side: 1 | -1, y = anchor.y || 0): Pose {
  const angle = anchor.angle, s = along(anchor, angle) + side * (anchor.state.w / 2 + w / 2), back = backLine(anchor, angle);
  return { ...toScene(s, back + d / 2, angle), y, angle };
}

/** Where a unit `d` deep stands over or under `anchor`, centred on it, backs in line, at `y`. */
export function stackedPose(anchor: UnitPose, d: number, y: number): Pose {
  const angle = anchor.angle;
  return { ...toScene(along(anchor, angle), backLine(anchor, angle) + d / 2, angle), y, angle };
}

/** Poses for `count` copies of `anchor` laid side by side from it towards `side`, nearest first. */
export function arrayPoses(anchor: UnitPose, count: number, side: 1 | -1): Pose[] {
  const poses: Pose[] = [];
  let from: UnitPose = anchor;
  for (let n = 0; n < count; n++) {
    const pose = besidePose(from, anchor.state.w, anchor.state.d, side);
    poses.push(pose);
    from = { ...anchor, ...pose };
  }
  return poses;
}

/** How many copies of a unit `width` wide a pull of `distance` centimetres from its side asks for. A copy
 * appears once the pull passes 40% of its width, so it follows the pointer without waiting a whole width. */
export const arrayCount = (distance: number, width: number, max = 12) => Math.max(0, Math.min(max, Math.floor(distance / width + .6)));
