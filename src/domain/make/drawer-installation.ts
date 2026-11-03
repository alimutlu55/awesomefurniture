import type { Board } from '../drawings/cabinet-boards';
import type { Fitting, Hole } from './make-joints';
import type { MakePiece } from './make-parts';
import type { Vec3 } from './make-measures';
import type { Playhead, Timeline } from './make-timeline';

/** Generic side-mounted telescopic runners; positions belong to this modeled system, not a branded drilling template. */
export function completeDrawerHardware(boards: readonly Board[], fittings: Fitting[], holes: Hole[]) {
  for (const [index, runner] of [...fittings].entries()) {
    if (runner.kind !== 'runner') continue;
    const left = runner.boards[0]!, b = boards[left]!;
    const right = boards.findIndex(q => q.name === 'Box side' && q.x0 > b.x0 && Math.abs(q.y0 - b.y0) < .01 && Math.abs(q.z0 - b.z0) < .01);
    if (right < 0) continue;
    const cabinetHoles = holes.filter(h => h.of === index && h.kind === 'runner');
    const fixed = [...new Set(cabinetHoles.map(h => h.board))], moving = [left, right];
    fittings[index] = { ...runner, boards: [...moving, ...fixed], runner: { moving, fixed } };
    // Rail fixing screws enter from inside the cabinet, never through the cabinet's exterior.
    for (const h of cabinetHoles) {
      const of = fittings.length;
      fittings.push({ kind: 'screw', at: h.at, axis: 0, boards: [h.board], size: '4 × 12', purpose: 'runner-mount' });
      holes[holes.indexOf(h)] = { ...h, d: 2.5, of };
    }
    for (const id of moving) {
      const side = boards[id]!, sign = id === left ? 1 : -1;
      for (const distance of [5, Math.max(8, side.z1 - side.z0 - 5)]) {
        const at: Vec3 = [id === left ? side.x0 : side.x1, side.y0 + 3.2, side.z1 - distance], of = fittings.length;
        fittings.push({ kind: 'screw', at, axis: 0, boards: [id], size: '4 × 12', purpose: 'runner-mount' });
        holes.push({ board: id, kind: 'runner', at, axis: 0, sign, d: 2.5, depth: 12, of });
      }
    }
    const front = boards.findIndex(q => q.stock === 'front' && q.x0 <= b.x0 && q.x1 >= boards[right]!.x1 && q.y0 < b.y0 && q.y1 > b.y1);
    const end = boards.findIndex(q => q.name === 'Box end' && q.x0 >= b.x1 - .01 && q.x1 <= boards[right]!.x0 + .01
      && Math.abs(q.y0 - b.y0) < .01 && Math.abs(q.z1 - b.z1) < .01);
    if (front < 0 || end < 0) continue;
    const e = boards[end]!, f = boards[front]!;
    for (const x of [e.x0 + (e.x1 - e.x0) * .2, e.x0 + (e.x1 - e.x0) * .8]) {
      const at: Vec3 = [x, (e.y0 + e.y1) / 2, e.z0], of = fittings.length;
      fittings.push({ kind: 'screw', at, axis: 2, boards: [end, front], size: '4 × 30', purpose: 'drawer-front' });
      holes.push({ board: end, kind: 'screw', at, axis: 2, sign: 1, d: 4, depth: 0, of },
        { board: front, kind: 'pilot', at: [x, at[1], f.z0], axis: 2, sign: 1, d: 2.5, depth: 12, of });
    }
  }
}

const unit = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = unit(v); return t * t * (3 - 2 * t); };
/** Drawer boxes are built outside the cabinet, then engaged with the runners as one rigid assembly. */
export function drawerBoardOffset(piece: MakePiece, tl: Timeline, ph: Playhead, board: number): Vec3 {
  const b = piece.boards[board]!, motion = piece.motions[board];
  if (motion?.kind !== 'slide') return [0, 0, 0];
  const install = piece.steps.findIndex(s => s.stage === 'drawers'), test = piece.steps.findIndex(s => s.stage === 'drawer-test');
  if (b.note === 'drawer box' && install >= 0) {
    const s = tl.steps[install]!, runner = drawerRunnerForBoard(piece, board);
    const length = Number(runner?.size) / 10 || motion.by / .7;
    if (ph.t < s.end) return [0, 0, (length + 8) * (1 - ease((ph.t - s.place[0]) / Math.max(.001, s.place[1] - s.place[0])))];
  }
  if (piece.steps[ph.step]?.stage === 'fronts') {
    const s = tl.steps[ph.step]!;
    if (ph.t < s.place[0]) return [0, 0, 0];
    if (ph.t < s.place[1]) {
      const opening = ease((ph.t - s.place[0]) / Math.max(.001, s.place[1] - s.place[0]));
      return [0, 0, motion.by * opening];
    }
    if (ph.t <= s.fix[1]) return [0, 0, motion.by];
    const closing = ease((ph.t - s.fix[1]) / Math.max(.001, s.end - s.fix[1]));
    return [0, 0, motion.by * (1 - closing)];
  }
  if (test < 0 || ph.step !== test) return [0, 0, 0];
  const s = tl.steps[test]!, runners = piece.fittings.filter(f => f.runner), own = runners.indexOf(drawerRunnerForBoard(piece, board)!);
  const progress = unit((ph.t - s.place[0]) / (s.place[1] - s.place[0])), local = progress * runners.length - Math.max(0, own);
  // Open, pause to see the telescoping members, close, then pause closed.
  const open = local < .35 ? ease(local / .35) : local < .55 ? 1 : 1 - ease((local - .55) / .35);
  return [0, 0, motion.by * open];
}

/** The pair belonging to a box panel or its decorative front; separate bays never share moving parts. */
export function drawerRunnerForBoard(piece: MakePiece, board: number): Fitting | undefined {
  const b = piece.boards[board]!;
  return piece.fittings.find(f => {
    if (!f.runner) return false;
    if (f.runner.moving.includes(board)) return true;
    const left = piece.boards[f.runner.moving[0]!]!, right = piece.boards[f.runner.moving[1]!] ?? left;
    return b.note === 'drawer box'
      ? b.x0 >= left.x0 - .01 && b.x1 <= right.x1 + .01 && b.y0 >= left.y0 - .61 && b.y1 <= left.y1 + .01
      : b.stock === 'front' && b.x0 <= left.x0 && b.x1 >= right.x1 && b.y0 <= left.y0 && b.y1 >= left.y1;
  });
}
