import { assemblyStageSpec, fittingTools } from '../hardware/hardware-registry';
import { TOOL_ORDER, type ToolKey } from '../hardware/tools';
import type { FittingKind } from './make-joints';
import type { MakePart, MakePiece } from './make-parts';

/**
 * What a flat-pack manual puts beside each step besides the picture: the tools, the hardware a drawer takes (once, with
 * how many drawers), which parts are handed, where the runners go and what not to do. Plain data from the piece; the
 * Studio and the PDF write it out.
 */

/** A count of one kind of hardware. */
export interface Count { readonly kind: FittingKind; readonly size?: string; readonly qty: number }
/** The hardware one drawer takes in a step, and how many drawers take the same. */
export interface DrawerKit { readonly drawers: number; readonly each: readonly Count[] }
/** Where a runner goes on an upright: its part, the face it is on, how high and how far back its holes are. Mm. */
export interface RunnerPlace { readonly part: number; readonly face: 'left' | 'right'; readonly up: number; readonly screws: readonly number[]; readonly peg: number }
export interface StepNotes {
  readonly tools: readonly ToolKey[];
  /** Drawer chapters: the kit per drawer (several when the drawers are not all alike). */
  readonly kits: readonly DrawerKit[];
  readonly runners: readonly RunnerPlace[];
  readonly avoid: readonly string[];
}

/** The runner a runner screw holds: the one whose peg is on the same face of the same upright, at the same height. */
function runnerOfScrew(piece: MakePiece, item: number): number {
  const hole = piece.holes.find(h => h.of === item);
  if (!hole) return -1;
  return piece.fittings.findIndex((r, ri) => !!r.runner && piece.holes.some(h => h.of === ri && h.board === hole.board && h.sign === hole.sign && Math.abs(h.at[1] - hole.at[1]) < .01));
}
/** The drawer (its place in `piece.drawers`) a fitting belongs to, or -1. */
function drawerOfFitting(piece: MakePiece, item: number): number {
  const f = piece.fittings[item]!, drawers = piece.drawers ?? [];
  const own = (k: number) => { const d = drawers[k]!; return [d.front, d.back, d.bottom, ...d.sides]; };
  const runner = f.purpose === 'runner-mount' ? piece.fittings[runnerOfScrew(piece, item)] : f;
  return runner ? drawers.findIndex((_, k) => (runner.runner?.moving ?? runner.boards).some(b => own(k).includes(b))) : -1;
}

/** The step's hardware a drawer at a time: drawers taking the same kit are counted together. */
export function drawerKits(piece: MakePiece, step: number): DrawerKit[] {
  const items = piece.steps[step]?.items ?? [], per = new Map<number, Map<string, Count>>();
  for (const i of items) {
    const k = drawerOfFitting(piece, i);
    if (k < 0) continue;
    const f = piece.fittings[i]!, key = f.kind + '|' + (f.size ?? ''), kit = per.get(k) ?? new Map<string, Count>(), had = kit.get(key);
    kit.set(key, { kind: f.kind, ...(f.size ? { size: f.size } : {}), qty: (had?.qty ?? 0) + 1 });
    per.set(k, kit);
  }
  const kits: { key: string; each: Count[]; drawers: number }[] = [];
  for (const kit of per.values()) {
    const each = [...kit.values()], key = JSON.stringify(each);
    const same = kits.find(x => x.key === key);
    if (same) same.drawers++; else kits.push({ key, each, drawers: 1 });
  }
  return kits.map(({ each, drawers }) => ({ drawers, each }));
}

/** Where each runner of the step goes on its upright: part number, face, height of its holes from the upright's lower
 * end, the screw holes and the peg hole back from its front edge. Millimetres, rounded. */
export function runnerPlaces(piece: MakePiece, step: number): RunnerPlace[] {
  const items = new Set(piece.steps[step]?.items ?? []), out: RunnerPlace[] = [];
  piece.fittings.forEach((r, index) => {
    if (!r.runner || !items.has(index)) return;
    for (const post of r.runner.fixed) {
      const b = piece.boards[post]!, peg = piece.holes.find(h => h.of === index && h.board === post);
      if (!peg) continue;
      // Its screws: the runner screws in the same face of this upright at its height.
      const screws = piece.holes.filter(h => h.board === post && h.sign === peg.sign && h.of !== undefined && h.of !== index && Math.abs(h.at[1] - peg.at[1]) < .01
        && piece.fittings[h.of]?.purpose === 'runner-mount').map(h => Math.round((b.z1 - h.at[2]) * 10)).sort((p, q) => p - q);
      const part = piece.parts.find(p => p.ids.includes(post))?.n ?? 0;
      out.push({ part, face: peg.sign > 0 ? 'left' : 'right', up: Math.round((peg.at[1] - b.y0) * 10), screws, peg: Math.round((b.z1 - peg.at[2]) * 10) });
    }
  });
  return out.filter((p, i) => out.findIndex(q => q.part === p.part && q.face === p.face && q.up === p.up) === i).sort((p, q) => p.part - q.part || p.up - q.up);
}

/** A part as one side of a drawer: 'left' or 'right' when every board of it is that side of its box, 'both' when it is
 * cut for either, null for any other part. */
export function drawerHand(piece: MakePiece, part: MakePart): 'left' | 'right' | 'both' | null {
  const hands = part.ids.map(id => (piece.drawers ?? []).find(d => d.sides.includes(id))).map((d, k) => d ? (d.sides[0] === part.ids[k] ? 'left' : 'right') : null);
  if (hands.some(h => h === null)) return null;
  return hands.every(h => h === hands[0]) ? hands[0]! : 'both';
}

/** The notes of step `k`: tools (the drill when it drills its own holes), drawer kits, runner places, what not to do. */
export function stepNotes(piece: MakePiece, k: number): StepNotes {
  const step = piece.steps[k]!, items = new Set(step.items), tools = new Set<ToolKey>();
  const drills = piece.holes.some(h => h.of !== undefined ? items.has(h.of) : step.boards.includes(h.board));
  if (drills) tools.add('drill');
  for (const i of step.items) for (const t of fittingTools(piece.fittings[i]!.kind, piece.fittings[i]!.size).tools) tools.add(t);
  return {
    tools: TOOL_ORDER.filter(t => tools.has(t)),
    kits: drawerKits(piece, k),
    runners: step.stage === 'drawer-runners' ? runnerPlaces(piece, k) : [],
    avoid: assemblyStageSpec(step.stage)?.avoid ?? [],
  };
}
