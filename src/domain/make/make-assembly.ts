import type { Board } from '../drawings/cabinet-boards';
import { type Axis, type Fitting, type FittingKind, type Hole, type HoleKind, hi, lo } from './make-joints';
import { thinAxis } from './make-measures';

/** A hole as it is marked on its board lying flat: millimetres along the board's length (u) and across it (v) from its
 * corner, on the face shown (+), the face under it (−), or in an edge (u0, u1: the ends; v0, v1: the long edges). */
export interface FlatHole { readonly kind: HoleKind; readonly u: number; readonly v: number; readonly d: number; readonly depth: number; readonly face: '+' | '-' | 'u0' | 'u1' | 'v0' | 'v1' }

const AX = { x: 0, y: 1, z: 2 } as const;
/** How a board lies flat: its length runs along `along` (with the grain), its width along `across`, its thickness `thin`. */
export function flatFrame(b: Board): { along: Axis; across: Axis; thin: Axis } {
  const thin = AX[thinAxis(b)], e = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0], others = ([0, 1, 2] as Axis[]).filter(a => a !== thin);
  const along = others.reduce((m, a) => Math.abs(e[a]! - b.cut.length) < Math.abs(e[m]! - b.cut.length) ? a : m, others[0]!);
  return { along, across: others.find(a => a !== along)!, thin };
}
/** A board's holes as marked on it lying flat. */
export function flatHoles(b: Board, holes: readonly Hole[]): FlatHole[] {
  const { along, across, thin } = flatFrame(b);
  return holes.map(h => {
    const u = Math.round((h.at[along] - lo(b)[along]) * 100) / 10, v = Math.round((h.at[across] - lo(b)[across]) * 100) / 10;
    const face = h.axis === thin ? (h.sign < 0 ? '+' : '-') : h.axis === along ? (h.sign > 0 ? 'u0' : 'u1') : (h.sign > 0 ? 'v0' : 'v1');
    return { kind: h.kind, u, v, d: h.d, depth: h.depth, face };
  });
}
/**
 * What tells two boards of one size apart once drilled: the same holes in the same places, or not. A board can be turned
 * end for end or over before it is drilled, so a left and a right drawer side drilled through alike are one part; a turn
 * that would move a banded edge (one long edge banded, say) is not allowed, so a handed carcass side stays handed.
 */
export function drillingSignature(b: Board, holes: readonly Hole[]): string {
  const flat = flatHoles(b, holes), L = Math.round(b.cut.length * 100) / 10, W = Math.round(b.cut.width * 100) / 10, band = bandCounts(b.edges);
  const swap: Record<FlatHole['face'], FlatHole['face']> = { '+': '-', '-': '+', u0: 'u1', u1: 'u0', v0: 'v1', v1: 'v0' };
  // Turns: end for end (u and v flip, same face up), over along its length (v flips), over across it (u flips).
  const turns = [[false, false, false], [true, true, false], [false, true, true], [true, false, true]] as const;
  const keep = (flipU: boolean, flipV: boolean) => (!flipU || band.short !== 1) && (!flipV || band.long !== 1);
  const sign = (flipU: boolean, flipV: boolean, over: boolean) => flat.map(h => {
    let face = h.face;
    if (over && (face === '+' || face === '-')) face = swap[face];
    if (flipU && (face === 'u0' || face === 'u1')) face = swap[face];
    if (flipV && (face === 'v0' || face === 'v1')) face = swap[face];
    const u = Math.round((flipU ? L - h.u : h.u) * 10) / 10, v = Math.round((flipV ? W - h.v : h.v) * 10) / 10;
    return `${h.kind}${h.depth === 0 && (face === '+' || face === '-') ? '±' : face}${h.d}@${u},${v}`;
  }).sort().join(' ');
  return turns.filter(([u, v]) => keep(u, v)).map(([u, v, over]) => sign(u, v, over)).sort()[0]!;
}
const bandCounts = (code: string) => ({ long: Number(/L(\d)/.exec(code)?.[1] ?? 0), short: Number(/W(\d)/.exec(code)?.[1] ?? 0) });

/** One step of putting the piece together: the boards it adds and the hardware that holds them. */
export interface Step { readonly n: number; readonly boards: readonly number[]; readonly fittings: readonly { kind: FittingKind; size?: string; qty: number }[] }
/**
 * The order a maker puts the piece together, from where each board is and what it is: the plinth; the base between the
 * outer sides; the partitions; the top; the back; everything inside (shelves, dividers, drawers); the doors and fronts.
 * Hardware joins in the step that adds the later of the boards it holds; legs with the plinth, hinge plates with the doors,
 * wall fixings last.
 */
export function assemblySteps(boards: readonly Board[], fittings: readonly Fitting[]): Step[] {
  const w = Math.max(...boards.map(b => b.x1)), h = Math.max(...boards.map(b => b.y1)), top = h;
  const horizontals = boards.filter(b => b.stock === 'carcass' && thinAxis(b) === 'y' && b.note !== 'drawer box');
  const base = horizontals.length ? Math.min(...horizontals.map(b => b.y0)) : -1;
  const stepOf = (b: Board) => {
    if (b.stock === 'plinth') return 1;
    if (b.stock === 'door' || b.stock === 'front') return 7;
    if (b.note === 'drawer box' || b.note === 'adjustable') return 6;
    if (b.stock === 'back') return 5;
    const t = thinAxis(b);
    if (t === 'x' && b.y1 - b.y0 > h * .4) return b.x0 < .5 || b.x1 > w - .5 ? 2 : 3;
    if (t === 'y' && b.y1 >= top - .05) return 4;
    if (t === 'y' && Math.abs(b.y0 - base) < .05) return 2;
    return 6;
  };
  const steps = boards.map(stepOf);
  const fittingStep = (f: Fitting) => f.kind === 'leg' ? 1 : f.kind === 'bracket' || f.kind === 'hanger' ? 8
    : f.kind === 'rail' || f.kind === 'support' ? 6 : f.kind === 'plate' ? 7 : Math.max(1, ...f.boards.map(i => steps[i]!));
  const out: Step[] = [];
  for (let s = 1; s <= 8; s++) {
    const mine = boards.map((_, i) => i).filter(i => steps[i] === s), held = new Map<string, { kind: FittingKind; size?: string; qty: number }>();
    for (const f of fittings) if (fittingStep(f) === s) {
      const key = f.kind + (f.size ?? ''), line = held.get(key);
      if (line) line.qty++; else held.set(key, { kind: f.kind, ...(f.size ? { size: f.size } : {}), qty: 1 });
    }
    if (mine.length || held.size) out.push({ n: out.length + 1, boards: mine, fittings: [...held.values()] });
  }
  return out;
}

/** The buy list: every piece of hardware, counted, with the boards it goes to. */
export interface BuyLine { readonly kind: FittingKind; readonly size?: string; readonly qty: number; readonly boards: readonly number[] }
export function buyList(fittings: readonly Fitting[]): BuyLine[] {
  const lines = new Map<string, { kind: FittingKind; size?: string; qty: number; boards: Set<number> }>();
  for (const f of fittings) {
    const key = f.kind + '|' + (f.size ?? ''), line = lines.get(key) ?? { kind: f.kind, ...(f.size ? { size: f.size } : {}), qty: 0, boards: new Set<number>() };
    line.qty++; f.boards.forEach(b => line.boards.add(b)); lines.set(key, line);
  }
  return [...lines.values()].map(l => ({ kind: l.kind, ...(l.size ? { size: l.size } : {}), qty: l.qty, boards: [...l.boards] }));
}

/** Something to look at before drilling: two holes running into each other, a hole too near an edge, a blind hole
 * breaking out of the far face, or two blind holes from both faces meeting inside the board. Millimetres. */
export interface Finding { readonly board: number; readonly kind: 'clash' | 'edge' | 'breakout' | 'meet'; readonly a: FlatHole; readonly b?: FlatHole; readonly gap: number }
export function drillingChecks(boards: readonly Board[], holes: readonly Hole[]): Finding[] {
  const out: Finding[] = [];
  boards.forEach((board, i) => {
    const mine = flatHoles(board, holes.filter(h => h.board === i)), L = board.cut.length * 10, W = board.cut.width * 10, T = board.cut.thickness * 10;
    const onFace = (h: FlatHole) => h.face === '+' || h.face === '-';
    for (const h of mine.filter(onFace)) {
      const edge = Math.min(h.u, L - h.u, h.v, W - h.v) - h.d / 2;
      if (edge < 3 && h.kind !== 'connector' && h.kind !== 'screw') out.push({ board: i, kind: 'edge', a: h, gap: Math.round(edge * 10) / 10 });
      if (h.depth > 0 && h.depth > T - 2.5) out.push({ board: i, kind: 'breakout', a: h, gap: Math.round((T - h.depth) * 10) / 10 });
    }
    for (let p = 0; p < mine.length; p++) for (let q = p + 1; q < mine.length; q++) {
      const a = mine[p]!, b = mine[q]!;
      if (!onFace(a) || !onFace(b)) continue;
      const dist = Math.hypot(a.u - b.u, a.v - b.v), through = a.depth === 0 || b.depth === 0;
      if (a.face === b.face || through) {
        const gap = dist - (a.d + b.d) / 2;
        if (gap < 2 && !(dist < .5 && a.kind === b.kind)) out.push({ board: i, kind: 'clash', a, b, gap: Math.round(gap * 10) / 10 });
      } else if (dist < (a.d + b.d) / 2 && a.depth + b.depth > T - 1) out.push({ board: i, kind: 'meet', a, b, gap: Math.round((T - a.depth - b.depth) * 10) / 10 });
    }
  });
  return out;
}

export { hi, lo };
