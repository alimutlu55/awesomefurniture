import type { MakePiece } from '../../domain/make/make-parts';
import { drawerBoardOffset } from '../../domain/make/drawer-installation';
import { entryOf, WAIT } from '../../domain/make/make-fixing';
import { drillAt, fittedAt, fixingNow, seeThrough, type Playhead, type Timeline } from '../../domain/make/make-timeline';
import type { Vec3 } from '../../domain/make/make-measures';
import type { AssemblyTarget } from './assembly-visibility';

/** Visibility is assessed for the active hardware, not every component in a chapter. */
export function assemblyTargets(piece: MakePiece, tl: Timeline, ph: Playhead): AssemblyTarget[] {
  const targets: AssemblyTarget[] = [], fixing = fixingNow(tl, ph);
  for (const i of fixing?.items ?? []) {
    const e = entryOf(piece, i);
    if (!e || e.board === null) continue;
    const progress = fittedAt(tl, ph, i, piece.fittings[i]!.kind);
    if (progress === null) continue;
    // Probe just outside the entry face, so a visible screw does not fade the board supporting it.
    for (const distance of [.2, Math.max(.2, WAIT * (1 - progress) ** 3)])
      targets.push({ board: e.board, at: e.at.map((v, k) => v - e.dir[k]! * distance) as unknown as Vec3 });
  }
  if (!fixing) piece.holes.forEach((h, i) => {
    if (drillAt(tl, ph, i) === null) return;
    targets.push({ board: h.board, at: h.at.map((v, k) => v - (h.axis === k ? h.sign * .2 : 0)) as unknown as Vec3 });
  });
  // While a door clips on, expose only panels hiding its hinge cups and arms from this camera.
  piece.fittings.forEach(f => {
    const board = f.boards[0];
    if (f.kind === 'hinge' && board !== undefined && seeThrough(tl, ph, board))
      targets.push({ board, at: [f.at[0], f.at[1], f.at[2] - .2] });
  });
  if (piece.steps[ph.step]?.stage === 'drawer-test') {
    const runners = piece.fittings.filter(f => f.runner), phase = tl.steps[ph.step]!.place;
    const fraction = Math.max(0, Math.min(.999, (ph.t - phase[0]) / (phase[1] - phase[0])));
    const runner = runners[Math.floor(fraction * runners.length)];
    // A completed/closed drawer is the finished product, not an internal mechanism demonstration.
    // The chapter can remain selected after its motion ends (including the film's final frame).
    const moving = runner?.runner?.moving ?? [], first = moving[0];
    if (first !== undefined && drawerBoardOffset(piece, tl, ph, first)[2] > .05) moving.forEach((id, k) => {
      const b = piece.boards[id]!;
      for (const z of [b.z0 + 5, b.z1 - 5]) targets.push({ board: id, at: [k === 0 ? b.x0 - .2 : b.x1 + .2, b.y0 + 3.2, z] });
    });
  }
  return targets;
}
