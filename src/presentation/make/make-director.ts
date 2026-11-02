import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import { lyingDir, lyingPoint, type Staged } from '../../domain/make/make-staging';
import { INTRO, OUTRO, type Timeline } from '../../domain/make/make-timeline';
import { entryOf, WAIT } from '../../domain/make/make-fixing';
import type { Vec3 } from '../../domain/make/make-measures';

/** A camera pose as the editor's camera holds it: turned `az` round the target, raised `el`, `dist` away. */
export interface Pose { az: number; el: number; dist: number; x: number; y: number; z: number }
interface Bounds { x: number; y: number; z: number; w: number; h: number; d: number }
/** The editor's own camera framing: the pose that fits `bounds` from `az`, `el`, and gliding from one pose to another. */
export interface DirectorCamera {
  fittedCamera(az: number, el: number, padding: number, bounds: Bounds): Pose;
  cameraSample(from: Pose, to: Pose, t: number): Pose;
}

/**
 * The assembly film's camera, as a building video is shot: it opens on the parts laid out, looks down on each step's
 * drilling, stands back as its boards are carried in, comes in close from the side the screws go in from, steps back,
 * and ends going slowly round the finished piece. Every shot is fitted with the editor's own framing, and the camera
 * glides from one to the next. Like the film, it is a function of the time: scrubbing shows the same shot.
 */
export function planShots(camera: DirectorCamera, piece: MakePiece, tl: Timeline, staged: readonly Staged[], toWorld: (p: THREE.Vector3) => THREE.Vector3, facing: number) {
  const { w, d } = piece.size, half = (p: readonly number[]) => toWorld(new THREE.Vector3(p[0]! - w / 2, p[1]!, p[2]! - d / 2));
  const placed = (i: number) => { const b = piece.boards[i]!; return corners([b.x0, b.y0, b.z0], [b.x1, b.y1, b.z1]).map(half); };
  const waiting = (i: number) => { const s = staged[i]!; return corners(s.at.map((v, k) => v - s.size[k]! / 2), s.at.map((v, k) => v + s.size[k]! / 2)).map(half); };
  const around = (p: readonly number[], r: number) => corners(p.map(v => v - r), p.map(v => v + r)).map(half);
  const all = piece.boards.map((_, i) => i), shots: { t: number; pose: Pose }[] = [];
  // Looking at a hinge plate on a side panel's inner face: from the front, across into the piece towards that face.
  const inside = (p: Vec3) => {
    const v = half([w / 2, p[1], d / 2]).sub(half(p)).setY(0).normalize().multiplyScalar(1.1).add(new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)));
    return Math.atan2(v.x, v.z);
  };
  const shot = (t: number, points: THREE.Vector3[], az: number, el: number, padding: number) => {
    if (points.length) shots.push({ t, pose: camera.fittedCamera(az, el, padding, bounds(points)) });
  };
  // Opening: every part laid out in front of where the piece will stand (its footprint on the floor), easing in.
  const floor = Math.min(...staged.map(s => s.at[1] - s.size[1] / 2)), site = corners([0, floor, 0], [w, floor + 1, d]).map(half);
  const everything = [...all.flatMap(waiting), ...site];
  shot(0, everything, facing + .7, .7, .95);
  shot(INTRO * .85, everything, facing + .45, .62, .8);
  tl.steps.forEach((s, k) => {
    const side = k % 2 ? 1 : -1, step = piece.steps[k]!, before = all.filter(i => tl.boardStep[i]! < k);
    const holes = piece.holes.map((h, i) => ({ h, i })).filter(({ i }) => tl.holeStep[i] === k);
    // Drilling: from above, on the boards waiting and the holes in what already stands.
    if (s.drill[1] > s.drill[0]) {
      const points = [...step.boards.flatMap(waiting), ...holes.filter(({ h }) => !step.boards.includes(h.board)).flatMap(({ h }) => around(h.at, 6))];
      shot(s.drill[0] + (s.drill[1] - s.drill[0]) * .45, points, facing + side * .35, .9, 1.12);
    }
    // Bringing the boards in: back far enough to see each come up from the floor to where it goes, then closer on the
    // piece as the last goes in.
    if (s.place[1] > s.place[0]) {
      const piece = [...step.boards.flatMap(placed), ...before.flatMap(placed)];
      shot(s.place[0] + (s.place[1] - s.place[0]) * .25, [...piece, ...step.boards.flatMap(waiting)], facing + side * .55, .45, 1.04);
      shot(s.place[0] + (s.place[1] - s.place[0]) * .9, piece, facing + side * .5, .4, 1.1);
    }
    // Fixing, joint by joint: close on each, from the side its screws go in from (a side's from outside it, the back's
    // nails from behind, a base's screws from above, a door's hinges from above it lying face down), held while they go
    // in one after another.
    s.fixes.forEach((fix, j) => {
      const entries = fix.items.map(i => entryOf(piece, i)).filter(e => e !== null), lying = fix.lying && fix.board !== null ? fix.board : null;
      const where = (p: Vec3): Vec3 => lying === null ? p : lyingPoint(piece.boards[lying]!, staged[lying]!, p), dir = lying === null ? fix.dir : lyingDir(staged[lying]!, fix.dir);
      // Hinge plates go on a side panel's inner face: seen from inside the piece, never through the panel, close on the
      // middle one so a plate reads as the part it is.
      const plates = fix.items.every(i => piece.fittings[i]!.kind === 'plate') && entries.length > 0, middle = entries[Math.floor(entries.length / 2)];
      const points = plates && middle ? around(middle.at, 14)
        : entries.flatMap(e => [...around(where(e.at), 5), ...around(where([e.at[0] - e.dir[0] * WAIT, e.at[1] - e.dir[1] * WAIT, e.at[2] - e.dir[2] * WAIT]), 3)]);
      // Across the way they go in, never down it, so each can be seen travelling to its hole: half a right angle off
      // their line, turned towards the front.
      const out = new THREE.Vector3(...dir).negate(), up = Math.abs(out.y) > .7, turn = j % 2 ? .25 : -.25;
      const w = out.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), facing), way = Math.atan2(w.x, w.z), off = (a: number) => Math.abs(Math.atan2(Math.sin(a - facing), Math.cos(a - facing)));
      const az = plates && middle ? inside(middle.at) : up ? facing + side * .3 + turn : [way + .85, way - .85].sort((a, b) => off(a) - off(b))[0]!, el = up ? (out.y > 0 ? .85 : .12) : plates ? .3 : .34;
      const span = fix.at[1] - fix.at[0];
      shot(fix.at[0] + span * .2, points, az, el, .95);
      shot(fix.at[1] - span * .08, points, az + turn * .3, el, .9);
    });
    // Hanging the doors: close on one hinge and its plate (the middle one of the first door), from the front and across
    // the way the plate went on, so the arm is seen going onto the plate as the door is pushed home.
    if (s.hang[1] > s.hang[0]) {
      const plates = step.items.filter(i => piece.fittings[i]!.kind === 'plate'), first = plates.filter(i => Math.abs(piece.fittings[i]!.at[0] - piece.fittings[plates[0]!]!.at[0]) < 5);
      const plate = first.sort((a, b) => piece.fittings[a]!.at[1] - piece.fittings[b]!.at[1])[Math.floor(first.length / 2)];
      const e = plate === undefined ? null : entryOf(piece, plate);
      if (e) {
        const points = [...around(e.at, 14), ...around([e.at[0], e.at[1], d + 6], 6)];
        shot(s.hang[0] - .3, points, inside(e.at), .35, 1);
        shot(s.hang[1] + .3, points, inside(e.at), .35, .95);
      }
    }
    // Adjusting the doors: square on to their fronts, close enough to read the gaps.
    if (s.adjust[1] > s.adjust[0]) {
      const doors = step.boards.flatMap(placed);
      shot(s.adjust[0] + .3, doors, facing, .12, .98);
      shot(s.adjust[1] - .2, doors, facing + side * .08, .12, .95);
    }
    // A breath: the piece so far.
    shot(s.end - .15, [...all.filter(i => tl.boardStep[i]! <= k).flatMap(placed)], facing + side * .45, .45, 1.1);
  });
  // The finished piece, turning slowly.
  shot(tl.duration - OUTRO + .6, all.flatMap(placed), facing + .65, .36, 1.06);
  shot(tl.duration, all.flatMap(placed), facing - .7, .26, 1.06);
  shots.sort((a, b) => a.t - b.t);
  /** The camera at time `t`: between the shots either side, glided with the editor's own easing. */
  return (t: number): Pose => {
    const next = shots.findIndex(s => s.t > t);
    if (next <= 0) return { ...shots[next === 0 ? 0 : shots.length - 1]!.pose };
    const a = shots[next - 1]!, b = shots[next]!;
    return camera.cameraSample(a.pose, b.pose, (t - a.t) / (b.t - a.t));
  };
}

function corners(lo: readonly number[], hi: readonly number[]) {
  const out: number[][] = [];
  for (const x of [lo[0]!, hi[0]!]) for (const y of [lo[1]!, hi[1]!]) for (const z of [lo[2]!, hi[2]!]) out.push([x, y, z]);
  return out;
}
function bounds(points: readonly THREE.Vector3[]): Bounds {
  const box = new THREE.Box3().setFromPoints([...points]), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  return { x: c.x, y: c.y, z: c.z, w: Math.max(s.x, 20), h: Math.max(s.y, 20), d: Math.max(s.z, 20) };
}
