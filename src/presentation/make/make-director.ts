import { cargoFittedAt } from '../../domain/make/cargo-installation';
import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import { hardwareStagingLayout, lyingDir, lyingPoint, type Staged } from '../../domain/make/make-staging';
import { drawerBoardOffset, drawerPose, drawerRunnerForBoard, runnerTravel } from '../../domain/make/drawer-installation';
import { drawerBoards, installWindow, poseDir, posePoint, shifted } from '../../domain/make/drawer-film';
import { INTRO, OUTRO, playhead, type Timeline } from '../../domain/make/make-timeline';
import { entryOf, WAIT } from '../../domain/make/make-fixing';
import type { Vec3 } from '../../domain/make/make-measures';

/** A drawer filmed while it is built has this much room round it, so a part going on is never cut off at the edge. */
const BOX_ROOM = 1.35;
/** The work in close-up: this much room round each joint or hole (cm), joints this far apart at most share a view, and the
 * view turned and raised this much off straight in front of the face (radians). */
const WORK_ROOM = 20, WORK_REACH = 115, WORK_TURN = .32, WORK_RAISE = .28;
/** How far round from the front a face inside the cabinet is seen (radians): as far as the opening lets the camera see it. */
const INSIDE_TURN = .6;
/** The least time between two camera shots (seconds). */
const STEADY = .35;

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
  /**
   * A drawer box chapter in three held views, always from the same side and height: the parts waiting beside the mat
   * while they are drilled and fitted (with any box on the mat that is drilled too); then each drawer in turn, whole and
   * with room round it, while its boards go on; then all the boxes on the mat while their joints are fixed.
   */
  function boxShots(s: (typeof tl.steps)[number], k: number) {
    const step = piece.steps[k]!, drawers = piece.drawers ?? [];
    // Each hold arrives in a short, even glide and is held to its end.
    const hold = (from: number, until: number, points: THREE.Vector3[], el: number, room = BOX_ROOM) => {
      if (!points.length || until <= from) return;
      shot(from + Math.min(.45, (until - from) * .3), points, facing + .25, el, room);
      shot(until - .05, points, facing + .25, el, room);
    };
    // 2. A drawer at a time, as its boards go on.
    const span = s.place[1] - s.place[0];
    drawers.forEach(d => {
      const mine = step.boards.filter(b => drawerBoards(d).includes(b));
      if (!mine.length) return;
      const from = s.place[0] + span * Math.min(...mine.map(b => tl.boardStart[b]!)), until = s.place[0] + span * Math.max(...mine.map(b => tl.boardStart[b]! + tl.boardWindow[b]!));
      hold(from, until, drawerBoards(d).flatMap(b => placed(b, until)), .52);
    });
    // Hold on the assembled drawer boxes on the mat at chapter end so the view never drifts onto empty floor.
    const builtBoxes = all.filter(i => tl.boardStep[i]! <= k && boxBoards.has(i)).flatMap(i => placed(i, s.end));
    if (builtBoxes.length) shot(s.end - .05, builtBoxes, facing + .28, .48, 1.2);
  }
  /**
   * The work, as a fitter looks at it: each hole drilled and each joint fixed seen from straight in front of the face the
   * drill or the hardware goes into, a little to the side and above so a screw or dowel shows along its length, and close:
   * the joint and what waits to go in, with contextual room. Joints next to each other on the same face share one view; the
   * camera holds still on each and glides to the next. Boards in front of the work go see-through (assembly-targets).
   */
  function workShots(s: (typeof tl.steps)[number], k: number) {
    const step = piece.steps[k]!, isRearStage = step.stage === 'back' || step.stage === 'wall';
    const side = hasCargo && ['drawer-runners', 'cargo-frame', 'cargo-baskets', 'drawers', 'fronts'].includes(step.stage) ? cargoSide : 1;
    const items: { from: number; until: number; at: Vec3[]; wait: Vec3[]; ctx: THREE.Vector3[]; out: Vec3; inside: boolean; onFloor: boolean; board: number | null }[] = [];
    // Work on the inside of the standing cabinet (a side's inner face) is seen through its front opening, never through a wall.
    const standing = (b: number | null, lying: boolean) => b !== null && !lying && !boxBoards.has(b) && piece.boards[b]!.stock === 'carcass';
    // Drilling: a board at a time, held while all its holes are drilled.
    const drillSpan = s.drill[1] - s.drill[0], drilledBoards: { board: number; from: number; holes: (typeof piece.holes)[number][] }[] = [];
    piece.holes.map((h, i) => ({ h, i })).filter(({ i }) => tl.holeStep[i] === k).sort((p, q) => tl.holeStart[p.i]! - tl.holeStart[q.i]!)
      .forEach(({ h, i }) => {
        if (drilledBoards.at(-1)?.board !== h.board) drilledBoards.push({ board: h.board, from: s.drill[0] + drillSpan * tl.holeStart[i]!, holes: [h] });
        else drilledBoards.at(-1)!.holes.push(h);
      });
    drilledBoards.forEach((d, n) => {
      const until = drilledBoards[n + 1]?.from ?? s.drill[1], lying = step.boards.includes(d.board), isStanding = standing(d.board, lying);
      const b = piece.boards[d.board]!, pose = poseAt(d.board, d.from);
      let points: THREE.Vector3[];
      if (lying) {
        points = waiting(d.board);
      } else if (isStanding && d.holes.length) {
        const ys = d.holes.map(h => h.at[1]), y0 = Math.max(b.y0, Math.min(...ys) - 28), y1 = Math.min(b.y1, Math.max(...ys) + 28);
        points = corners([b.x0, y0, b.z0], [b.x1, y1, b.z1]).map(p => half(posePoint(pose, p as unknown as Vec3)));
      } else {
        points = placed(d.board, d.from);
      }
      const firstHole = d.holes[0];
      const drillAz = isStanding && firstHole?.axis === 0 ? facing - firstHole.sign * INSIDE_TURN : facing + WORK_TURN;
      const drillEl = isStanding ? .38 : .68;
      shot(d.from + Math.min(.45, (until - d.from) * .3), points, drillAz, drillEl, 1.18);
      shot(until - .05, points, drillAz, drillEl, 1.18);
    });
    // A joint: its hardware going in, from where it waits.
    for (const fix of s.fixes) {
      const lying = fix.lying && fix.board !== null ? fix.board : null, mid = (fix.at[0] + fix.at[1]) / 2;
      // A locking plate is laid on its runner's front pin, pulled out in the cabinet, from above.
      const plate = fix.items.every(i => piece.fittings[i]!.purpose === 'drawer-plate');
      const poseFor = (b: number | null) => b === null ? null : plate ? shifted([0, 0, runnerTravel(piece, tl, playhead(tl, mid), b)]) : poseAt(b, mid);
      const where = (p: Vec3, b = fix.board): Vec3 => {
        if (fix.lying && b !== null) return lyingPoint(piece.boards[b]!, staged[b]!, p);
        const pose = poseFor(b);
        return pose ? posePoint(pose, p) : p;
      };
      const entries = fix.items.map(i => entryOf(piece, i)).filter(e => e !== null);
      if (!entries.length) continue;
      const pose = poseFor(fix.board);
      const dir = lying !== null ? lyingDir(staged[lying]!, fix.dir) : pose ? poseDir(pose, fix.dir) : fix.dir;
      const ctx: THREE.Vector3[] = [];
      if (BOX_STAGES.has(step.stage) && fix.board !== null && lying === null) {
        const drawer = (piece.drawers ?? []).find(d => drawerBoards(d).includes(fix.board!));
        if (drawer) ctx.push(...drawerBoards(drawer).filter(b => tl.boardStep[b]! <= k).flatMap(b => placed(b, mid)));
      } else if (fix.board !== null && lying === null) {
        const b = piece.boards[fix.board]!;
        if (b.stock === 'door' || b.stock === 'front') {
          const yMid = entries.reduce((sum, e) => sum + e.at[1], 0) / entries.length;
          ctx.push(...around([b.x0, yMid, b.z1], 14), ...around([b.x1, yMid, b.z1], 14));
        }
      }
      items.push({
        from: fix.at[0], until: fix.at[1],
        at: entries.map(e => where(e.at, e.board)),
        wait: entries.map(e => where([e.at[0] - e.dir[0] * WAIT, e.at[1] - e.dir[1] * WAIT, e.at[2] - e.dir[2] * WAIT], e.board)),
        ctx,
        out: plate ? [0, 1, 0] : [-dir[0], -dir[1], -dir[2]],
        inside: standing(fix.board, lying !== null),
        onFloor: lying !== null || BOX_STAGES.has(step.stage),
        board: fix.board,
      });
    }
    items.sort((p, q) => p.from - q.from);
    // Next to each other on the same face of the same board: one view.
    const views: typeof items = [];
    for (const it of items) {
      const last = views.at(-1), same = last && last.board === it.board && last.out[0] * it.out[0] + last.out[1] * it.out[1] + last.out[2] * it.out[2] > .95;
      if (last && same && reach([...last.at, ...it.at].map(half)) <= WORK_REACH) {
        last.at.push(...it.at); last.wait.push(...it.wait); last.ctx.push(...it.ctx); last.until = Math.max(last.until, it.until);
      } else views.push({ ...it, at: [...it.at], wait: [...it.wait], ctx: [...it.ctx] });
    }
    views.forEach((v, n) => {
      const until = Math.max(v.until, views[n + 1]?.from ?? v.until), w = new THREE.Vector3(...v.out).applyAxisAngle(new THREE.Vector3(0, 1, 0), facing);
      const forward = w.x * Math.sin(facing) + w.z * Math.cos(facing);
      const across = Math.abs(forward) < .5, sideways = Math.sign(w.x * Math.cos(facing) - w.z * Math.sin(facing)) || side;
      const flat = Math.abs(v.out[1]) > .85, low = Math.min(...v.at.map(p => p[1])) < floor + 25;
      let az: number, el: number;
      if (flat) {
        az = facing + side * WORK_TURN;
        el = v.out[1] > 0 ? (v.onFloor ? .65 : .5) : .35;
      } else if (across) {
        az = facing + sideways * (v.inside ? INSIDE_TURN : .58);
        el = v.onFloor ? .48 : .32;
      } else if (forward < 0) {
        az = isRearStage ? facing + side * 2.38 : facing + side * .45;
        el = .32;
      } else {
        az = Math.atan2(w.x, w.z) + side * WORK_TURN;
        el = Math.max(.22, Math.min(.72, Math.asin(Math.max(-1, Math.min(1, v.out[1]))) + WORK_RAISE));
      }
      if (low) el = Math.max(.38, el);
      const room = BOX_STAGES.has(step.stage) ? 12 : isRearStage ? 26 : WORK_ROOM;
      const points = [...v.at.flatMap(p => around(p, room)), ...v.wait.flatMap(p => around(p, 4)), ...v.ctx];
      shot(v.from + Math.min(.45, (until - v.from) * .3), points, az, el, 1.2);
      shot(until - .05, points, az, el, 1.2);
    });
  }
  tl.steps.forEach((s, k) => {
    const step = piece.steps[k]!, boxStep = BOX_STAGES.has(step.stage), runnerStep = step.stage === 'drawer-runners' && !hasCargo && !!piece.drawers?.length;
    // What is already built that a shot shows with this step's boards: the piece so far, or the drawer boxes so far.
    const before = all.filter(i => tl.boardStep[i]! < k && (!boxStep || boxBoards.has(i)));
    const isCargoStage = hasCargo && ['drawer-runners', 'cargo-frame', 'cargo-baskets', 'drawers', 'fronts'].includes(step.stage);
    // One side of the piece for the whole film, so the camera never swings across between chapters.
    const side = isCargoStage ? cargoSide : 1;
    if (boxStep) boxShots(s, k);
    workShots(s, k);
    // Compute each destination at the time of its shot: a drawer can move during this phase.
    // Travel demonstrations have their own stable shots below, instead of competing wide placement shots.
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

    // Hanging the doors: frame the hinge line of the first door with cabinet opening context from the front-inside angle,
    // so the hinge arms are seen clipping onto the plates as the door is pushed home.
    if (s.hang[1] > s.hang[0]) {
      const plates = step.items.filter(i => piece.fittings[i]!.kind === 'plate'), first = plates.filter(i => Math.abs(piece.fittings[i]!.at[0] - piece.fittings[plates[0]!]!.at[0]) < 5);
      const plate = first.sort((a, b) => piece.fittings[a]!.at[1] - piece.fittings[b]!.at[1])[Math.floor(first.length / 2)];
      const e = plate === undefined ? null : entryOf(piece, plate);
      if (e) {
        const points = [...first.flatMap(i => around(piece.fittings[i]!.at, 20)), ...around([w / 2, e.at[1], d + 4], 16)];
        shot(s.hang[0] + .15, points, inside(e.at), .26, 1.08);
        shot(s.hang[1] - .05, points, inside(e.at), .26, 1.05);
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
    } else if (!boxStep && !runnerStep) {
      // A breath: the piece so far, at this moment rather than at the chapter's start (including any staged/installed cargo mechanism).
      // The drawer and runner chapters hold their own view to their end instead.
      const time = s.end - .15;
      const builtBoards = all.filter(i => tl.boardStep[i]! <= k && (!boxStep || boxBoards.has(i))).flatMap(i => placed(i, time));
      const fittingPoints = builtBoards.length ? [] : step.items.flatMap(i => around(piece.fittings[i]!.at, 18));
      const breathPoints = [
        ...builtBoards,
        ...fittingPoints,
        ...cargoPointsAt(time, k),
      ];
      shot(time, breathPoints, facing + side * (isCargoStage ? .48 : .45), isCargoStage ? .36 : .42, isCargoStage ? 1.14 : 1.1);
    }
  });
  // The finished piece, turning slowly.
  shot(tl.duration - OUTRO + .6, all.flatMap(i => placed(i, tl.duration)), facing + .65, .36, 1.06);
  shot(tl.duration, all.flatMap(i => placed(i, tl.duration)), facing - .7, .26, 1.06);
  shots.sort((a, b) => a.t - b.t);
  // Never two moves in a moment: a shot less than STEADY after the one before waits until STEADY has passed, so a held
  // view is held to its end and every move takes its time.
  for (let i = 1; i < shots.length; i++) if (shots[i]!.t - shots[i - 1]!.t < STEADY) shots[i]!.t = shots[i - 1]!.t + STEADY;
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
