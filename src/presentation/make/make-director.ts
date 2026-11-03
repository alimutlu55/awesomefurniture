import { cargoFittedAt } from '../../domain/make/cargo-installation';
import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import { hardwareStagingLayout, lyingDir, lyingPoint, type Staged } from '../../domain/make/make-staging';
import { drawerBoardOffset, drawerRunnerForBoard } from '../../domain/make/drawer-installation';
import { INTRO, OUTRO, playhead, type Timeline } from '../../domain/make/make-timeline';
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
  const placed = (i: number, time: number) => {
    const b = piece.boards[i]!, offset = drawerBoardOffset(piece, tl, playhead(tl, time), i)[2];
    return corners([b.x0, b.y0, b.z0 + offset], [b.x1, b.y1, b.z1 + offset]).map(half);
  };
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
  const hwStaged = hardwareStagingLayout(piece, staged, floor);
  const hwWaiting = [...hwStaged.values()].flatMap(s => corners(s.at.map((v, k) => v - s.size[k]! / 2), s.at.map((v, k) => v + s.size[k]! / 2)).map(half));
  const everything = [...all.flatMap(waiting), ...hwWaiting, ...site];
  const cargoFrameFitting = piece.fittings.find(f => f.size?.startsWith('cargo frame:'));
  const hasCargo = piece.fittings.some(f => f.size?.includes('cargo'));
  const cargoMount = cargoFrameFitting?.size?.split(':')[3] ?? 'bottom';
  const cargoSide = cargoMount === 'left' ? -1 : 1;
  // Envelope of any staged/installed cargo frame & baskets at `time` so external assembly steps never clip off-screen.
  const cargoPointsAt = (time: number, upToStep: number) => {
    if (!hasCargo) return [];
    const ph = playhead(tl, time), pts: THREE.Vector3[] = [];
    piece.fittings.forEach((f, item) => {
      if (tl.itemStep[item]! > upToStep) return;
      if (!f.size?.includes('cargo frame') && !f.size?.includes('cargo basket')) return;
      const st = hwStaged.get(item), p = cargoFittedAt(piece, tl, ph, item);
      if (!st || p === null) return;
      const ease = p * p * (3 - 2 * p);
      const centre = st.at.map((v, axis) => v + (f.at[axis]! - v) * ease);
      centre[1]! += 20 * Math.sin(Math.PI * ease);
      const front = f.boards[0];
      if (front !== undefined) centre[2]! += drawerBoardOffset(piece, tl, ph, front)[2] * ease;
      const rx = Math.max(10, piece.size.w * .4), ry = f.size?.includes('cargo frame') ? piece.size.h * .42 : 12, rz = Math.max(20, piece.size.d * .42);
      pts.push(...corners([centre[0]! - rx, Math.max(floor, centre[1]! - ry), centre[2]! - rz], [centre[0]! + rx, centre[1]! + ry, centre[2]! + rz]).map(half));
    });
    return pts;
  };
  shot(0, everything, facing + .7, .7, .95);
  shot(INTRO * .85, everything, facing + .45, .62, .8);
  tl.steps.forEach((s, k) => {
    const step = piece.steps[k]!, before = all.filter(i => tl.boardStep[i]! < k);
    const isCargoStage = hasCargo && ['drawer-runners', 'cargo-frame', 'cargo-baskets', 'drawers', 'fronts'].includes(step.stage);
    const side = isCargoStage ? cargoSide : (k % 2 ? 1 : -1);
    const holes = piece.holes.map((h, i) => ({ h, i })).filter(({ i }) => tl.holeStep[i] === k);
    // Drilling: from above, on the boards waiting and the holes in what already stands.
    if (s.drill[1] > s.drill[0]) {
      const time = s.drill[0] + (s.drill[1] - s.drill[0]) * .45;
      const points = [...step.boards.flatMap(waiting), ...holes.filter(({ h }) => !step.boards.includes(h.board)).flatMap(({ h }) => {
        const offset = drawerBoardOffset(piece, tl, playhead(tl, time), h.board);
        return around([h.at[0] + offset[0], h.at[1] + offset[1], h.at[2] + offset[2]], 6);
      })];
      shot(time, points, facing + side * .35, .9, 1.12);
    }
    // Compute each destination at the time of its shot: a drawer can move during this phase.
    // Travel demonstrations have their own stable shots below, instead of competing wide placement shots.
    if (s.place[1] > s.place[0] && step.stage !== 'drawer-test') {
      for (const fraction of [.25, .9]) {
        const time = s.place[0] + (s.place[1] - s.place[0]) * fraction;
        const points = [...step.boards, ...before].flatMap(i => placed(i, time));
        if (fraction === .25) points.push(...step.boards.flatMap(waiting));
        if (isCargoStage) {
          points.push(...cargoPointsAt(time, k));
          shot(time, points, facing + cargoSide * .48, .36, 1.14);
        } else {
          shot(time, points, facing + side * (fraction === .25 ? .55 : .5), fraction === .25 ? .45 : .4, fraction === .25 ? 1.04 : 1.1);
        }
      }
    }

    // Fixing, joint by joint: close on each, from the side its screws go in from (a side's from outside it, the back's
    // nails from behind, a base's screws from above, a door's hinges from above it lying face down), held while they go
    // in one after another.
    s.fixes.forEach((fix, j) => {
      const entries = fix.items.map(i => entryOf(piece, i)).filter(e => e !== null), lying = fix.lying && fix.board !== null ? fix.board : null;
      const where = (p: Vec3): Vec3 => {
        if (lying !== null) return lyingPoint(piece.boards[lying]!, staged[lying]!, p);
        const offset = fix.board === null ? [0, 0, 0] : drawerBoardOffset(piece, tl, playhead(tl, (fix.at[0] + fix.at[1]) / 2), fix.board);
        return [p[0] + offset[0]!, p[1] + offset[1]!, p[2] + offset[2]!];
      }, dir = lying === null ? fix.dir : lyingDir(staged[lying]!, fix.dir);
      // Hinge plates go on a side panel's inner face: seen from inside the piece, never through the panel, close on the
      // middle one so a plate reads as the part it is.
      const plates = fix.items.every(i => piece.fittings[i]!.kind === 'plate'
        || (piece.fittings[i]!.purpose === 'runner-mount' && fix.board !== null && piece.boards[fix.board]!.note !== 'drawer box'))
        && entries.length > 0, middle = entries[Math.floor(entries.length / 2)];
      // A runner group can span several drawers and the full rail depth: frame all screws, not just the middle one.
      const hingePlate = fix.items.every(i => piece.fittings[i]!.kind === 'plate' && !piece.fittings[i]!.size?.includes('cargo'));
      const padRadius = isCargoStage ? 10 : 5;
      const points = hingePlate && middle ? around(where(middle.at), 14)
        : entries.flatMap(e => [...around(where(e.at), padRadius), ...around(where([e.at[0] - e.dir[0] * WAIT, e.at[1] - e.dir[1] * WAIT, e.at[2] - e.dir[2] * WAIT]), 4)]);
      // Across the way they go in, never down it, so each can be seen travelling to its hole: half a right angle off
      // their line, turned towards the front.
      const out = new THREE.Vector3(...dir).negate(), up = Math.abs(out.y) > .7, turn = j % 2 ? .25 : -.25;
      const w = out.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), facing), way = Math.atan2(w.x, w.z), off = (a: number) => Math.abs(Math.atan2(Math.sin(a - facing), Math.cos(a - facing)));
      const az = plates && middle ? inside(where(middle.at)) : up ? facing + side * .3 + turn : [way + .85, way - .85].sort((a, b) => off(a) - off(b))[0]!, el = up ? (out.y > 0 ? .85 : .12) : plates ? .3 : .34;
      const span = fix.at[1] - fix.at[0], fixPad = isCargoStage ? 1.08 : .95;
      shot(fix.at[0] + span * .2, points, az, el, fixPad);
      shot(fix.at[1] - span * .08, points, az + turn * .2, el, fixPad);
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
      const doors = step.boards.flatMap(i => placed(i, s.adjust[0]));
      shot(s.adjust[0] + .3, doors, facing, .12, .98);
      shot(s.adjust[1] - .2, doors, facing + side * .08, .12, .95);
    }
    if (step.stage === 'drawer-test') {
      const runners = piece.fittings.filter(f => f.runner), duration = (s.place[1] - s.place[0]) / runners.length;
      runners.forEach((runner, j) => {
        const start = s.place[0] + duration * j, open = start + duration * .45;
        const active = all.filter(i => piece.motions[i]?.kind === 'slide' && drawerRunnerForBoard(piece, i) === runner);
        // Fit the full swept space once. The camera holds while this drawer opens and closes.
        const points = active.flatMap(i => [...placed(i, start), ...placed(i, open)]);
        for (const i of runner.runner!.moving) {
          const b = piece.boards[i]!;
          points.push(...corners([b.x0 - 2, b.y0 - 3, b.z0], [b.x1 + 2, b.y1 + 3, b.z1]).map(half));
        }
        // Leave a short glide between drawers, outside their moving interval.
        const azAngle = hasCargo ? facing + cargoSide * .48 : facing + .65;
        shot(start + duration * .03, points, azAngle, .36, 1.15);
        shot(start + duration * .97, points, azAngle, .36, 1.15);
      });
    } else {
      // A breath: the piece so far, at this moment rather than at the chapter's start (including any staged/installed cargo mechanism).
      const time = s.end - .15;
      const breathPoints = [
        ...all.filter(i => tl.boardStep[i]! <= k).flatMap(i => placed(i, time)),
        ...cargoPointsAt(time, k),
      ];
      shot(time, breathPoints, facing + side * (isCargoStage ? .48 : .45), isCargoStage ? .36 : .45, isCargoStage ? 1.14 : 1.1);
    }
  });
  // The finished piece, turning slowly.
  shot(tl.duration - OUTRO + .6, all.flatMap(i => placed(i, tl.duration)), facing + .65, .36, 1.06);
  shot(tl.duration, all.flatMap(i => placed(i, tl.duration)), facing - .7, .26, 1.06);
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
