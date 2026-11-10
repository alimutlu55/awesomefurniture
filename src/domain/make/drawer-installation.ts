import { onPulloutFrame } from '../kitchen/cargo-pullout';
import type { Board } from '../drawings/cabinet-boards';
import { RUNNER_ENTRY } from '../hardware/hardware-registry';
import type { Fitting, Hole } from './make-joints';
import type { MakePiece } from './make-parts';
import type { Vec3 } from './make-measures';
import type { Playhead, Timeline } from './make-timeline';
import { benchPose, runnerPull, shifted, type DrawerPose } from './drawer-film';

const CABINET_MOUNT_FIXING = RUNNER_ENTRY.fixings.find(f => f.target === 'side')!;
const FRONT_FIXING = RUNNER_ENTRY.fixings.find(f => f.target === 'front')!;
/** Screws through each runner's front bracket; its other cabinet holes take the rear peg. */
const FRONT_SCREWS = RUNNER_ENTRY.drilling[0]?.stationsMm?.length ?? 2;

/**
 * Bottom-mounted runners (drawer-box.ts, drawer-hardware.ts): each pair moves with the box's two sides and is fixed to
 * the uprights only, screwed through its front bracket; the rear hole takes its peg. Nothing is screwed into the box.
 * An applied kitchen front is screwed on from inside the box front.
 */
export function completeDrawerHardware(boards: readonly Board[], fittings: Fitting[], holes: Hole[]) {
  for (const [index, runner] of [...fittings].entries()) {
    if (runner.kind !== 'runner' || runner.runner) continue;
    const left = runner.boards[0]!, b = boards[left]!;
    const right = boards.findIndex(q => q.name === 'Box side' && q.x0 > b.x0 && Math.abs(q.y0 - b.y0) < .01 && Math.abs(q.z0 - b.z0) < .01);
    if (right < 0) continue;
    const cabinetHoles = holes.filter(h => h.of === index && h.kind === 'runner');
    // Left upright with the left box side, right with the right: by where they stand, not by the order of their holes.
    const fixed = [...new Set(cabinetHoles.map(h => h.board))].sort((p, q) => boards[p]!.x0 - boards[q]!.x0), moving = [left, right];
    fittings[index] = { ...runner, boards: [...moving, ...fixed], runner: { moving, fixed } };
    // Rail fixing screws enter from inside the cabinet, never through the cabinet's exterior: the front bracket's two.
    for (const post of fixed) {
      const front = cabinetHoles.filter(h => h.board === post).sort((p, q) => q.at[2] - p.at[2]).slice(0, FRONT_SCREWS);
      for (const h of front) {
        const of = fittings.length;
        fittings.push({ kind: 'screw', at: h.at, axis: 0, boards: [h.board], size: CABINET_MOUNT_FIXING.size, purpose: CABINET_MOUNT_FIXING.purpose ?? 'runner-mount' });
        holes[holes.indexOf(h)] = { ...h, d: CABINET_MOUNT_FIXING.pilotHole?.dMm ?? 2.5, of };
      }
    }
    const r = boards[right]!;
    const boxFront = boards.findIndex(q => q.name === 'Box front' && q.x0 <= b.x0 + .01 && q.x1 >= r.x1 - .01 && Math.abs(q.y0 - b.y0) < .01);
    if (boxFront < 0) continue;
    const e = boards[boxFront]!, front = boards.findIndex(q => q.stock === 'front' && q.z0 >= e.z1 - .01 && q.x0 <= e.x0 + .01 && q.x1 >= e.x1 - .01 && q.y0 <= e.y0 && q.y1 >= e.y1);
    if (front < 0) continue;
    const f = boards[front]!;
    for (const x of [e.x0 + (e.x1 - e.x0) * .2, e.x0 + (e.x1 - e.x0) * .8]) {
      const at: Vec3 = [x, (e.y0 + e.y1) / 2, e.z0], of = fittings.length;
      fittings.push({ kind: 'screw', at, axis: 2, boards: [boxFront, front], size: FRONT_FIXING.size, purpose: FRONT_FIXING.purpose ?? 'drawer-front' });
      holes.push({ board: boxFront, kind: 'screw', at, axis: 2, sign: 1, d: 4, depth: 0, of },
        { board: front, kind: 'pilot', at: [x, at[1], f.z0], axis: 2, sign: 1, d: FRONT_FIXING.pilotHole?.dMm ?? 2.5, depth: FRONT_FIXING.pilotHole?.depthMm ?? 12, of });
    }
  }
}

const unit = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = unit(v); return t * t * (3 - 2 * t); };
/** Where a drawer board is at the playhead, as a rigid pose: a box on the mat or going onto its runners (drawer-film.ts),
 * else moved in the cabinet (drawerBoardOffset). */
export function drawerPose(piece: MakePiece, tl: Timeline, ph: Playhead, board: number, floor = 0): DrawerPose {
  return benchPose(piece, tl, ph, board, floor) ?? shifted(drawerBoardOffset(piece, tl, ph, board));
}
/** How far the runners under a drawer board are pulled out: pulled out to take the boxes, then with their drawer. */
export function runnerTravel(piece: MakePiece, tl: Timeline, ph: Playhead, board: number): number {
  const pull = runnerPull(piece, tl, ph, board);
  if (pull !== null) return pull;
  return benchPose(piece, tl, ph, board) ? 0 : drawerBoardOffset(piece, tl, ph, board)[2];
}

/** A drawer in the cabinet: pulled out while its levers are turned or its applied front is fixed, opened in the travel
 * test; a cargo front carried in. A box on the mat or going onto its runners is drawer-film.ts's. */
export function drawerBoardOffset(piece: MakePiece, tl: Timeline, ph: Playhead, board: number): Vec3 {
  const b = piece.boards[board]!, motion = piece.motions[board];
  if (motion?.kind !== 'slide') return [0, 0, 0];
  const install = piece.steps.findIndex(s => s.stage === 'drawers'), test = piece.steps.findIndex(s => s.stage === 'drawer-test');
  if (onPulloutFrame(b) && install >= 0 && ph.t < tl.steps[install]!.end) {
    const s=tl.steps[install]!,length=Number(drawerRunnerForBoard(piece,board)?.size)/10;
    return [0,0,(length+10)*(1-ease((ph.t-s.place[0])/Math.max(.001,s.place[1]-s.place[0])))];
  }
  // Drawers stand out while the levers are turned under them (drawer-box.ts): pulled out before the first lever goes on,
  // held, pushed home once the last is turned.
  if (piece.steps[ph.step]?.stage === 'drawer-lock') {
    const s = tl.steps[ph.step]!, lead = Math.max(.001, s.fix[0] - s.start);
    if (ph.t <= s.start) return [0, 0, 0];
    if (ph.t < s.fix[0]) return [0, 0, motion.by * ease((ph.t - s.start) / lead)];
    if (ph.t <= s.fix[1]) return [0, 0, motion.by];
    return [0, 0, motion.by * (1 - ease((ph.t - s.fix[1]) / Math.max(.001, s.end - s.fix[1])))];
  }
  if (piece.steps[ph.step]?.stage === 'fronts') {
    const s = tl.steps[ph.step]!;
    if (ph.t < s.place[0]) return [0, 0, 0];
    if (ph.t < s.place[1]) {
      const opening = ease((ph.t - s.place[0]) / Math.max(.001, s.place[1] - s.place[0]));
      return [0, 0, motion.by * opening];
    }
    if (ph.t <= s.fix[1]) return [0, 0, motion.by];
    const closeSpan = s.adjust[1] > s.adjust[0] ? Math.min(1.2, (s.end - s.fix[1]) * .35) : s.end - s.fix[1];
    const closing = ease((ph.t - s.fix[1]) / Math.max(.001, closeSpan));
    return [0, 0, motion.by * (1 - closing)];
  }
  if (test < 0 || ph.step !== test) return [0, 0, 0];
  const s = tl.steps[test]!, runners = piece.fittings.filter(f => f.runner), own = runners.indexOf(drawerRunnerForBoard(piece, board)!);
  // A front on no runner has nothing to slide on: it stays shut rather than going out with another drawer.
  if (own < 0) return [0, 0, 0];
  const progress = unit((ph.t - s.place[0]) / (s.place[1] - s.place[0])), local = progress * runners.length - own;
  // Open, pause to see the telescoping members, close, then pause closed.
  const open = local < .35 ? ease(local / .35) : local < .55 ? 1 : 1 - ease((local - .55) / .35);
  return [0, 0, motion.by * open];
}

/** The pair belonging to a box panel or its decorative front; separate bays never share moving parts. */
export function drawerRunnerForBoard(piece: MakePiece, board: number): Fitting | undefined {
  const b = piece.boards[board]!;
  const drawer = (piece.drawers ?? []).find(d => [d.front, d.applied, d.back, d.bottom, ...d.sides].includes(board));
  return piece.fittings.find(f => {
    if (!f.runner) return false;
    if (f.runner.moving.includes(board)) return true;
    if (drawer) return f.runner.moving.includes(drawer.sides[0]);
    const left = piece.boards[f.runner.moving[0]!]!, right = piece.boards[f.runner.moving[1]!] ?? left;
    return b.note === 'drawer box'
      ? b.x0 >= left.x0 - .01 && b.x1 <= right.x1 + .01 && b.y0 >= left.y0 - .61 && b.y1 <= left.y1 + .01
      : b.stock === 'front' && b.x0 <= left.x0 && b.x1 >= right.x1 && b.y0 <= left.y0 && b.y1 >= left.y1;
  });
}
