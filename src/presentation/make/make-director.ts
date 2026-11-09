import { cargoFittedAt } from '../../domain/make/cargo-installation';
import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import { hardwareStagingLayout, lyingDir, lyingPoint, type Staged } from '../../domain/make/make-staging';
import { drawerBoardOffset, drawerPose, drawerRunnerForBoard, runnerTravel } from '../../domain/make/drawer-installation';
import { drawerBoards, installWindow, poseDir, posePoint, shifted } from '../../domain/make/drawer-film';
import { INTRO, OUTRO, playhead, type Timeline } from '../../domain/make/make-timeline';
import { entryOf, WAIT } from '../../domain/make/make-fixing';
import type { Vec3 } from '../../domain/make/make-measures';

/** The most one drilling shot takes in (cm): boards further apart than this get a shot each. */
const DRILL_REACH = 130;

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
  // Where the floor is (a hung unit's parts lie below it), and so the mat the drawer boxes are built on.
  const floor = staged.length ? Math.min(...staged.map(s => s.at[1] - s.size[1] / 2)) : 0;
  const poseAt = (i: number, time: number) => drawerPose(piece, tl, playhead(tl, time), i, floor);
  const placed = (i: number, time: number) => {
    const b = piece.boards[i]!, pose = poseAt(i, time);
    return corners([b.x0, b.y0, b.z0], [b.x1, b.y1, b.z1]).map(p => half(posePoint(pose, p as unknown as Vec3)));
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
  const site = corners([0, floor, 0], [w, floor + 1, d]).map(half);
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
  // A drawer box is put together outside the cabinet: while it is, the camera is on the box, not the cabinet.
  const boxBoards = new Set((piece.drawers ?? []).flatMap(d => [d.front, d.bottom, d.back, ...d.sides]));
  const BOX_STAGES: ReadonlySet<string> = new Set(['drawer-boxes', 'drawer-sides', 'drawer-back']);
  tl.steps.forEach((s, k) => {
    const step = piece.steps[k]!, boxStep = BOX_STAGES.has(step.stage);
    // What is already built that a shot shows with this step's boards: the piece so far, or the drawer boxes so far.
    const before = all.filter(i => tl.boardStep[i]! < k && (!boxStep || boxBoards.has(i)));
    const isCargoStage = hasCargo && ['drawer-runners', 'cargo-frame', 'cargo-baskets', 'drawers', 'fronts'].includes(step.stage);
    const side = isCargoStage ? cargoSide : (k % 2 ? 1 : -1);
    const holes = piece.holes.map((h, i) => ({ h, i })).filter(({ i }) => tl.holeStep[i] === k);
    // Drilling follows the drill: the boards lying on the floor, then the holes in what stands, board by board in the order
    // they are drilled. Neighbours drilled one after another share a shot while they are close together; the camera moves
    // when the drill goes somewhere it cannot be seen from here, and holds while it works.
    if (s.drill[1] > s.drill[0]) {
      const span = s.drill[1] - s.drill[0], at = (f: number) => s.drill[0] + span * f;
      const groups: { board: number; from: number; points: THREE.Vector3[]; lying: boolean; down: boolean }[] = [];
      for (const { h, i } of [...holes].sort((p, q) => tl.holeStart[p.i]! - tl.holeStart[q.i]!)) {
        const lying = step.boards.includes(h.board), last = groups.at(-1);
        // A hole in a drawer box on the mat is drilled with the whole box in view, not a wall of board.
        const box = !lying && boxStep ? (piece.drawers ?? []).find(q => drawerBoards(q).includes(h.board)) : undefined;
        const points = lying ? waiting(h.board) : box ? drawerBoards(box).flatMap(j => placed(j, at(.5))) : around(posePoint(poseAt(h.board, at(.5)), h.at), 9);
        if (last && last.lying === lying && (last.board === h.board || reach([...last.points, ...points]) <= DRILL_REACH)) {
          if (last.board !== h.board || !lying) last.points.push(...points);
          last.board = h.board; last.down &&= h.axis === 1;
        } else groups.push({ board: h.board, from: tl.holeStart[i]!, points, lying, down: h.axis === 1 });
      }
      groups.forEach((g, n) => {
        const from = n ? g.from : 0, to = groups[n + 1]?.from ?? 1, el = g.lying ? .9 : g.down ? .95 : .55, padding = g.lying ? 1.12 : 1.15;
        shot(at(from + Math.min(.12, (to - from) * .35)), g.points, facing + side * .35, el, padding);
        shot(at(to), g.points, facing + side * .35, el, padding);
      });
    }
    // Compute each destination at the time of its shot: a drawer can move during this phase.
    // Travel demonstrations have their own stable shots below, instead of competing wide placement shots.
    // A drawer box's boards go on one at a time: the whole box in view through each one's turn, a little closer as it goes
    // on (the back seen from above, as it is hooked over the bottom's edge and swung shut).
    if (boxStep && s.place[1] > s.place[0]) for (const i of step.boards) {
      const d = (piece.drawers ?? []).find(q => drawerBoards(q).includes(i));
      if (!d) continue;
      const span = s.place[1] - s.place[0], a = s.place[0] + span * tl.boardStart[i]!, b = a + span * tl.boardWindow[i]!;
      const box = drawerBoards(d).flatMap(j => placed(j, b)), el = step.stage === 'drawer-back' ? .62 : .5;
      shot(a + (b - a) * .05, box, facing + side * .4, el, 1.5);
      shot(b - (b - a) * .05, box, facing + side * .4, el, 1.3);
    }
    if (s.place[1] > s.place[0] && step.stage !== 'drawer-test' && !boxStep && !(step.stage === 'drawers' && piece.drawers?.length)) {
      for (const fraction of [.25, .9]) {
        const time = s.place[0] + (s.place[1] - s.place[0]) * fraction;
        // Where the boards go, in what they go onto, so it is clear what goes where as they come in from wherever they wait
        // on the floor (which can be far off: those are never framed).
        const points = [...step.boards, ...before].flatMap(i => placed(i, time));
        if (isCargoStage) {
          points.push(...cargoPointsAt(time, k));
          shot(time, points, facing + cargoSide * .48, .36, 1.14);
        } else {
          shot(time, points, facing + side * (fraction === .25 ? .55 : .5), fraction === .25 ? .45 : .4, fraction === .25 ? 1.2 : 1.1);
        }
      }
    }

    // Fixing, joint by joint: close on each, from the side its screws go in from (a side's from outside it, the back's
    // nails from behind, a base's screws from above, a door's hinges from above it lying face down), held while they go
    // in one after another.
    s.fixes.forEach((fix, j) => {
      const entries = fix.items.map(i => entryOf(piece, i)).filter(e => e !== null), lying = fix.lying && fix.board !== null ? fix.board : null;
      // A drawer box's joint is where the box is then: on the mat, front face down, while it is built.
      // A locking plate is laid on its runner's front pin, pulled out in the cabinet: framed there, from above.
      const plate = fix.items.every(i => piece.fittings[i]!.purpose === 'drawer-plate'), mid = (fix.at[0] + fix.at[1]) / 2;
      const pose = fix.board === null ? null : plate ? shifted([0, 0, runnerTravel(piece, tl, playhead(tl, mid), fix.board)]) : poseAt(fix.board, mid);
      const where = (p: Vec3): Vec3 => {
        if (lying !== null) return lyingPoint(piece.boards[lying]!, staged[lying]!, p);
        return pose ? posePoint(pose, p) : p;
      }, dir = lying === null ? (pose ? poseDir(pose, fix.dir) : fix.dir) : lyingDir(staged[lying]!, fix.dir);
      // Hinge plates go on a side panel's inner face: seen from inside the piece, never through the panel, close on the
      // middle one so a plate reads as the part it is.
      const plates = fix.items.every(i => piece.fittings[i]!.kind === 'plate'
        || (piece.fittings[i]!.purpose === 'runner-mount' && fix.board !== null && piece.boards[fix.board]!.note !== 'drawer box'))
        && entries.length > 0, middle = entries[Math.floor(entries.length / 2)];
      // A runner group can span several drawers and the full rail depth: frame all screws, not just the middle one.
      const hingePlate = fix.items.every(i => piece.fittings[i]!.kind === 'plate' && !piece.fittings[i]!.size?.includes('cargo'));
      const purpose0 = piece.fittings[fix.items[0]!]!.purpose;
      // A drawer lock is small and under a drawer: with enough round it to see which drawer and which side.
      const padRadius = isCargoStage ? 10 : fix.items.some(i => piece.fittings[i]!.kind === 'drawerLock') ? 14 : 8;
      // The back's dowels are hammered with the whole back in view, so it is clear where they go and that it is shut.
      const backBox = purpose0 === 'box-back' && fix.board !== null ? (piece.drawers ?? []).find(q => drawerBoards(q).includes(fix.board!)) : undefined;
      const points = backBox ? drawerBoards(backBox).flatMap(j => placed(j, (fix.at[0] + fix.at[1]) / 2))
        : hingePlate && middle ? around(where(middle.at), 14)
        : entries.flatMap(e => [...around(where(e.at), padRadius), ...around(where([e.at[0] - e.dir[0] * WAIT, e.at[1] - e.dir[1] * WAIT, e.at[2] - e.dir[2] * WAIT]), 4)]);
      // Across the way they go in, never down it, so each can be seen travelling to its hole: half a right angle off
      // their line, turned towards the front.
      const out = new THREE.Vector3(...dir).negate(), up = Math.abs(out.y) > .7, turn = j % 2 ? .25 : -.25;
      const w = out.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), facing), way = Math.atan2(w.x, w.z), off = (a: number) => Math.abs(Math.atan2(Math.sin(a - facing), Math.cos(a - facing)));
      const purpose = piece.fittings[fix.items[0]!]!.purpose, kind = piece.fittings[fix.items[0]!]!.kind;
      // Seen where they can be seen: a drawer's locking plates and levers from below it, a drawer side's cams from above,
      // looking down into the box, and the expanding dowels through a drawer back from above and behind it.
      // A lever is screwed on from under the drawer; a locking plate is laid on the pin from above.
      const below = kind === 'drawerLock' && piece.fittings[fix.items[0]!]!.size === 'lever', into = purpose === 'box-sides' && kind === 'cam', overBack = purpose === 'box-back';
      const az = plates && middle ? inside(where(middle.at)) : below || into || plate ? facing + side * .45 : up ? facing + side * .3 + turn
        : [way + .85, way - .85].sort((a, b) => off(a) - off(b))[0]!;
      const el = below ? -.28 : plate ? .6 : into ? .8 : overBack ? .62 : up ? (out.y > 0 ? .85 : .12) : plates ? .3 : .34;
      const span = fix.at[1] - fix.at[0], fixPad = backBox ? 1.25 : isCargoStage ? 1.08 : 1.12;
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
    // Putting the drawers on, one after another: lifted off the mat towards its runners, hooked on at the back with the
    // front held up and lowered onto the pins, seen from above the front; then pushed home.
    if (step.stage === 'drawers') (piece.drawers ?? []).forEach((drawer, j) => {
      const window = installWindow(piece, tl, j);
      if (!window) return;
      const [a, b] = window, span = b - a, box = drawerBoards(drawer), at = (f: number) => box.flatMap(i => placed(i, a + span * f));
      shot(a + span * .06, [...at(0), ...at(1)], facing + side * .5, .42, 1.12);
      shot(a + span * .5, [...at(.5), ...at(.7)], facing + side * .4, .55, 1.25);
      shot(a + span * .74, [...at(.7), ...at(1)], facing + side * .4, .5, 1.25);
      shot(b - span * .04, at(1), facing + side * .45, .4, 1.6);
    });
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
        shot(start + duration * .03, points, azAngle, .4, 1.5);
        shot(start + duration * .97, points, azAngle, .4, 1.5);
      });
      // Then the whole piece, every drawer home.
      shot(s.end - .15, all.filter(i => tl.boardStep[i]! <= k).flatMap(i => placed(i, s.end)), facing + .45, .4, 1.1);
    } else {
      // A breath: the piece so far, at this moment rather than at the chapter's start (including any staged/installed cargo mechanism).
      const time = s.end - .15;
      const breathPoints = [
        ...all.filter(i => tl.boardStep[i]! <= k && (!boxStep || boxBoards.has(i))).flatMap(i => placed(i, time)),
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
/** How far a set of points spreads: the longest side of the box round them. */
function reach(points: readonly THREE.Vector3[]) {
  const s = new THREE.Box3().setFromPoints([...points]).getSize(new THREE.Vector3());
  return Math.max(s.x, s.y, s.z);
}
function bounds(points: readonly THREE.Vector3[]): Bounds {
  const box = new THREE.Box3().setFromPoints([...points]), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  return { x: c.x, y: c.y, z: c.z, w: Math.max(s.x, 20), h: Math.max(s.y, 20), d: Math.max(s.z, 20) };
}
