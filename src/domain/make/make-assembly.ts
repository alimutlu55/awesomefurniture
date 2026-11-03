import { boreMaterial } from './bore-material';
import type { Board } from '../drawings/cabinet-boards';
import { type Axis, type Fitting, type FittingKind, type Hole, type HoleKind, hi, lo } from './make-joints';
import { thinAxis, tiltOf } from './make-measures';

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
/** The cut face in the same length/width axes used for drilling, centimetres. */
export function flatOutline(b: Board): { x: number; y: number }[] {
  if (b.outline && thinAxis(b) === 'z') {
    const { along, across } = flatFrame(b), origin = lo(b);
    return b.outline.map(p => {
      const at = [p.x, p.y, b.z0];
      return { x: at[along]! - origin[along], y: at[across]! - origin[across] };
    });
  }
  return [{ x: 0, y: 0 }, { x: b.cut.length, y: 0 }, { x: b.cut.length, y: b.cut.width }, { x: 0, y: b.cut.width }];
}

/** A board's holes as marked on it lying flat. */
export function flatHoles(b: Board, holes: readonly Hole[]): FlatHole[] {
  const { along, across, thin } = flatFrame(b), tilt = tiltOf(b), slope = tilt ? b.cut.length / (hi(b)[along] - lo(b)[along]) : 1;
  return holes.map(h => {
    // On a sloped top a hole's place along the board is measured along the slope.
    const settle = (v: number) => Number(v.toPrecision(12));
    const u = settle((h.at[along] - lo(b)[along]) * slope * 10), v = settle((h.at[across] - lo(b)[across]) * 10);
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
  const flat = flatHoles(b, holes), L = b.cut.length * 10, W = b.cut.width * 10, band = bandCounts(b.edges);
  const swap: Record<FlatHole['face'], FlatHole['face']> = { '+': '-', '-': '+', u0: 'u1', u1: 'u0', v0: 'v1', v1: 'v0' };
  // Turns: end for end (u and v flip, same face up), over along its length (v flips), over across it (u flips).
  const turns = [[false, false, false], [true, true, false], [false, true, true], [true, false, true]] as const;
  const keep = (flipU: boolean, flipV: boolean) => (!flipU || band.short !== 1) && (!flipV || band.long !== 1);
  const sign = (flipU: boolean, flipV: boolean, over: boolean) => flat.map(h => {
    let face = h.face;
    if (over && (face === '+' || face === '-')) face = swap[face];
    if (flipU && (face === 'u0' || face === 'u1')) face = swap[face];
    if (flipV && (face === 'v0' || face === 'v1')) face = swap[face];
    const u = Number((flipU ? L - h.u : h.u).toPrecision(12)), v = Number((flipV ? W - h.v : h.v).toPrecision(12));
    return `${h.kind}${h.depth === 0 && (face === '+' || face === '-') ? '±' : face}${h.d}/${h.depth}@${u},${v}`;
  }).sort().join(' ');
  return turns.filter(([u, v]) => keep(u, v)).map(([u, v, over]) => sign(u, v, over)).sort()[0]!;
}
const bandCounts = (code: string) => ({ long: Number(/L(\d)/.exec(code)?.[1] ?? 0), short: Number(/W(\d)/.exec(code)?.[1] ?? 0) });

/** One step of putting the piece together: the boards it adds and the hardware that holds them. */
/** What a step does, in the order a maker works. */
export const STAGES = ['plinth', 'carcass', 'partitions', 'top', 'back', 'inside', 'drawer-boxes', 'drawer-runners', 'cargo-frame', 'cargo-baskets', 'drawers', 'fronts', 'drawer-test', 'doors', 'wall'] as const;
export type Stage = typeof STAGES[number];
export interface Step {
  readonly n: number;
  readonly stage: Stage;
  readonly boards: readonly number[];
  readonly fittings: readonly { kind: FittingKind; size?: string; qty: number }[];
  /** The fittings it adds, by their place in the piece's list. */
  readonly items: readonly number[];
}
/**
 * The order a maker puts the piece together, from where each board is and what it is: the plinth; the base between the
 * outer sides; the partitions; the top; the back; everything inside (shelves, dividers); the drawer boxes on their
 * runners; the fronts (drawer and kitchen fronts); the doors, hung on their hinge plates and adjusted.
 * Hardware joins in the step that adds the later of the boards it holds; legs with the plinth, a hinge plate with its
 * door (the hinge before it in the list), wall fixings last.
 */
export function assemblySteps(boards: readonly Board[], fittings: readonly Fitting[]): Step[] {
  const w = Math.max(...boards.map(b => b.x1)), h = Math.max(...boards.map(b => b.y1)), top = h;
  const horizontals = boards.filter(b => b.stock === 'carcass' && thinAxis(b) === 'y' && b.note !== 'drawer box');
  const base = horizontals.length ? Math.min(...horizontals.map(b => b.y0)) : -1;
  const stepOf = (b: Board): Stage => {
    if (b.stock === 'plinth') return 'plinth';
    if (b.stock === 'door') return 'doors';
    if (b.stock === 'front') return 'fronts';
    if (b.note === 'drawer box') return 'drawer-boxes';
    if (b.note === 'adjustable') return 'inside';
    if (b.stock === 'back') return 'back';
    const t = thinAxis(b);
    if (t === 'x' && b.y1 - b.y0 > h * .4) return b.x0 < .5 || b.x1 > w - .5 ? 'carcass' : 'partitions';
    if (t === 'y' && b.y1 >= top - .05) return 'top';
    if (t === 'y' && Math.abs(b.y0 - base) < .05) return 'carcass';
    return 'inside';
  };
  const steps = boards.map(stepOf);
  const fittingStep = (f: Fitting, i: number): Stage => {
    if (f.kind === 'leg') return 'plinth';
    if (f.kind === 'bracket' || f.kind === 'hanger') return f.size?.includes('cargo') ? 'fronts' : 'wall';
    if (f.kind === 'rail' || f.kind === 'support') return f.size?.includes('cargo') ? (f.kind === 'rail' ? 'cargo-baskets' : 'cargo-frame') : 'inside';
    if (f.purpose === 'cargo-lock') return 'drawers';
    if (f.kind === 'runner' || f.purpose === 'runner-mount') return 'drawer-runners';
    if (f.purpose === 'drawer-front' || f.purpose === 'front-fixing' || f.size?.includes('cargo')) return 'fronts';
    if (f.kind === 'plate' && fittings[i - 1]?.kind === 'hinge') return fittingStep(fittings[i - 1]!, i - 1);
    return STAGES[Math.max(0, ...f.boards.map(b => STAGES.indexOf(steps[b]!)))]!;
  };
  const out: Step[] = [], hasDrawers = fittings.some(f => f.runner || f.kind === 'runner');
  for (const stage of STAGES) {
    const mine = boards.map((_, i) => i).filter(i => steps[i] === stage);
    const held = new Map<string, { kind: FittingKind; size?: string; qty: number }>(), items: number[] = [];
    fittings.forEach((f, i) => {
      if (fittingStep(f, i) !== stage) return;
      const key = f.kind + (f.size ?? ''), line = held.get(key);
      if (line) line.qty++; else held.set(key, { kind: f.kind, ...(f.size ? { size: f.size } : {}), qty: 1 });
      items.push(i);
    });
    if (mine.length || held.size || (hasDrawers && (stage === 'drawers' || stage === 'drawer-test')))
      out.push({ n: out.length + 1, stage, boards: mine, fittings: [...held.values()], items });
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
    holes.filter(h=>h.board===i).forEach((h,k)=>{for(const f of boreMaterial(board,h)) out.push({board:i,a:mine[k]!,...f});});
    for (const h of mine.filter(onFace)) {
      const edge = Math.min(h.u, L - h.u, h.v, W - h.v) - h.d / 2;
      if (edge < 3 && h.kind !== 'connector' && h.kind !== 'screw' && !out.some(f => f.board === i && f.a === h && f.kind === 'edge')) out.push({ board: i, kind: 'edge', a: h, gap: Math.round(edge * 10) / 10 });
      if (h.depth > 0 && h.depth > T - 2.5 && !out.some(f => f.board === i && f.a === h && f.kind === 'breakout')) out.push({ board: i, kind: 'breakout', a: h, gap: Math.round((T - h.depth) * 10) / 10 });
    }
    for (let p = 0; p < mine.length; p++) for (let q = p + 1; q < mine.length; q++) {
      const a = mine[p]!, b = mine[q]!;
      if (!onFace(a) || !onFace(b)) continue;
      const dist = Math.hypot(a.u - b.u, a.v - b.v), through = a.depth === 0 || b.depth === 0;
      if (a.face === b.face || through) {
        const gap = dist - (a.d + b.d) / 2;
        if (gap < 2 && !(dist < .5 && a.kind === b.kind && a.face === b.face)) out.push({ board: i, kind: 'clash', a, b, gap: Math.round(gap * 10) / 10 });
      } else if (dist < (a.d + b.d) / 2 && a.depth + b.depth > T - 1) out.push({ board: i, kind: 'meet', a, b, gap: Math.round((T - a.depth - b.depth) * 10) / 10 });
    }
  });
  return out;
}

/** The holes a finding is about, by their place in the piece's hole list: the one, or the two that meet. */
export function findingHoles(boards: readonly Board[], holes: readonly Hole[], f: Finding): number[] {
  const mine = holes.flatMap((h, i) => h.board === f.board ? [i] : []), flat = flatHoles(boards[f.board]!, mine.map(i => holes[i]!));
  const same = (p: FlatHole, q: FlatHole | undefined) => !!q && p.u === q.u && p.v === q.v && p.face === q.face && p.kind === q.kind;
  return mine.filter((_, k) => same(flat[k]!, f.a) || same(flat[k]!, f.b));
}

export { hi, lo };
