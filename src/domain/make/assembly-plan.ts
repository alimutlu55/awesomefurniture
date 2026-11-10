import type { Board } from '../drawings/cabinet-boards';
import { BOARD_MINUTES, fitMinutes } from '../engine/passport';
import { assemblyStageSpec, hardware } from '../hardware/hardware-registry';
import type { Step } from './make-assembly';
import { doorGaps } from './make-fixing';
import { type Fitting, type FittingKind, isTilted } from './make-joints';
import type { MakePiece } from './make-parts';
import { thinAxis } from './make-measures';
import { isStructural, type JointChoice, type Stage } from './make-sequence';
import { standUpHeight } from './stand-up';

/**
 * The assembly plan: a piece's steps written out the way someone at a bench needs them, worked out from the piece and
 * never written for one. For each step: which numbered parts, each one's way in and where it ends up; every joint and
 * every piece of hardware with how many, what size, which parts it joins and how far each is from an edge you can put
 * a tape on; the screws that hold it; what to measure before going on, with the number to read; how long it takes and
 * how many hands. Before the first step: how to build it (lying down and stood up, or standing where it goes), the
 * room that needs, and the tools.
 *
 * Nothing here knows a wardrobe from a kitchen unit. Wording comes from the hardware registry (each entry's
 * `assembly.instructions`, each stage's title); numbers come from the piece's boards, fittings, holes and build order
 * (make-sequence.ts). A piece of a kind nobody has built yet gets its plan the same way.
 *
 * Millimetres throughout: these are numbers to read off a tape.
 */

const AX = { x: 0, y: 1, z: 2 } as const;
type Axis = 0 | 1 | 2;
const mm = (cm: number) => Math.round(cm * 100) / 10;
const lo = (b: Board) => [b.x0, b.y0, b.z0] as const, hi = (b: Board) => [b.x1, b.y1, b.z1] as const;

export interface PlanPart { readonly n: number; readonly name: string; readonly qty: number; readonly size: readonly [number, number, number] }
/** One board going in: which part, and in words how it goes in and where it ends up. */
export interface PlanPlace { readonly part: number; readonly board: number; readonly text: string }
/** Where a row of fasteners goes: each this far from `from` of part `on`, on a line `line` from another edge. */
export interface PlanSetOut {
  readonly on: number;
  readonly from: 'left end' | 'bottom edge' | 'back edge';
  readonly mm: readonly number[];
  readonly line?: { readonly from: 'front edge' | 'left end' | 'bottom edge'; readonly mm: number } | undefined;
}
/** One joint made or one kind of hardware fitted on one part. */
export interface PlanFix {
  readonly kind: FittingKind;
  readonly size?: string | undefined;
  readonly qty: number;
  /** What it is called to do, and how, from the hardware registry. */
  readonly title: string;
  readonly how: string;
  /** The parts it joins or sits on, by part number: through the first into the second for a connector. */
  readonly parts: readonly number[];
  readonly at?: PlanSetOut | undefined;
  /** The screws that hold it. */
  readonly with: readonly { readonly size: string; readonly qty: number }[];
  /** Why this joint has another connector than the piece's own, or how the board closes onto it. */
  readonly note?: string | undefined;
  /** The fittings it covers, by their place in the piece's list. */
  readonly items: readonly number[];
  /** The board of this step it is made after, by its place in the piece's board list; absent for hardware fitted to what already stands. */
  readonly after?: number | undefined;
}
export interface PlanCheck { readonly text: string; readonly value?: number | undefined; readonly tolerance?: number | undefined }
export interface PlanStep {
  readonly n: number;
  readonly stage: Stage;
  readonly title: string;
  readonly summary: string;
  readonly parts: readonly PlanPart[];
  readonly places: readonly PlanPlace[];
  readonly fixes: readonly PlanFix[];
  readonly checks: readonly PlanCheck[];
  readonly minutes: number;
  readonly people: 1 | 2;
}
export interface PlanMethod {
  /** On a bench (a small piece), lying on the floor and stood up, or standing where it goes. */
  readonly posture: 'bench' | 'lying' | 'standing';
  /** The ceiling height it needs to be stood up after being built lying down. */
  readonly standUp: number;
  /** The room's ceiling, when the piece is in a room. */
  readonly ceiling?: number | undefined;
  /** The floor it needs lying down: its width and height with room to walk round. */
  readonly floor: readonly [number, number];
  readonly text: string;
}
export interface AssemblyPlan {
  readonly method: PlanMethod;
  readonly people: 1 | 2;
  readonly minutes: number;
  readonly tools: readonly string[];
  readonly steps: readonly PlanStep[];
}
export interface PlanOptions {
  /** The ceiling over the piece, centimetres; absent when it stands in no room. */
  readonly ceiling?: number | undefined;
}

/** A piece from this height is built lying on the floor; a lower one on a bench. Two people from here, too. Centimetres. */
const TALL = 120;
/** Room to walk round a piece lying on the floor. */
const WALK = 80;

const NOTES: Readonly<Record<NonNullable<JointChoice['instead']>, string>> = {
  covered: 'Dowels here, glued: a screw\'s head would be behind a part already in place. Push the part onto them as it goes in.',
  underneath: 'Dowels here, glued: a screw would have to be driven from under the piece. Lower the part onto them.',
  captured: 'Screwed here: between parts already in place this one cannot travel onto dowels or cam bolts.',
};

function partsOf(mp: MakePiece, step: Step): PlanPart[] {
  return mp.parts.flatMap(p => {
    const qty = p.ids.filter(i => step.boards.includes(i)).length;
    return qty ? [{ n: p.n, name: p.name, qty, size: [mm(p.cut.length), mm(p.cut.width), mm(p.cut.thickness)] as const }] : [];
  });
}

/** How a board goes in and where it ends up, from its shape, its place, its step and the joints it closes. */
function place(mp: MakePiece, board: number, stage: Stage, partOf: (i: number) => number): PlanPlace {
  const b = mp.boards[board]!, t = thinAxis(b), { w } = mp.size, n = partOf(board), label = `part ${n} ${b.name}`, rank = mp.sequence.rank;
  const say = (text: string): PlanPlace => ({ part: n, board, text });
  // A drawer box is built on the bench, in the order of its own steps (drawer-box.ts).
  if (stage === 'drawer-boxes') return say(b.stock === 'back' ? `Slide ${label} into the groove of its front, the same gap at both ends.` : `Lay ${label} face down on a soft mat.`);
  if (stage === 'drawer-sides') return say(`Set ${label} over the bolts and dowels of its front, the bottom in its groove.`);
  if (stage === 'drawer-back') return say(`Hook ${label} over the back edge of the bottom and swing it up against the ends of the sides.`);
  if (b.stock === 'door') return say(`Hang ${label}: hold it in front of its opening, slide each hinge arm onto its plate and press until it clicks.`);
  if (b.stock === 'front') return say(`Offer up ${label} to its place and hold it there while it is fixed.`);
  if (b.stock === 'back') {
    return say(mp.construction.back === 'grooved' ? `Slide ${label} down its grooves from the top, good face to the inside, until it sits in the base.`
      : `Lay ${label} on the rear of the carcass, good face down, its edges in the rebates.`);
  }
  // The parts already in place that it meets: the ones it stands on, and the ones it stands against or under.
  const partner = (c: JointChoice) => c.joint.face === board ? c.joint.edge : c.joint.face;
  const met = mp.joints.filter(c => (c.joint.face === board || c.joint.edge === board) && rank[partner(c)]! < rank[board]!);
  const below = (c: JointChoice) => c.joint.axis === 1 && mp.boards[partner(c)]!.y1 <= b.y0 + .05;
  const numbers = (cs: readonly JointChoice[]) => [...new Set(cs.map(c => partOf(partner(c))))].filter(p => p !== n).sort((p, q) => p - q);
  const list = (ns: readonly number[]) => ns.length === 1 ? 'part ' + ns[0] : 'parts ' + ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1];
  const on = numbers(met.filter(below)), against = numbers(met.filter(c => !below(c))).filter(p => !on.includes(p));
  const meets = (on.length ? ' on ' + list(on) : '') + (against.length ? ' against ' + list(against) : '');
  const verb = isTilted(b) ? 'Lower' : t === 'x' ? 'Stand' : t === 'y' ? 'Set' : 'Stand';
  const where: string[] = [];
  if (t === 'x') where.push(b.x0 < .05 ? 'at the left end' : b.x1 > w - .05 ? 'at the right end, closing the carcass' : `its left face ${mm(b.x0)} mm from the left end of the piece`);
  if (t === 'y') where.push(`its top face ${mm(b.y1)} mm above the floor`);
  if (t === 'z') where.push(`on edge, its front face ${mm(mp.size.d - b.z1)} mm back from the front of the piece`);
  // One long edge banded: that edge is the one seen, at the front.
  if (/L1/.test(b.edges) && b.stock !== 'plinth') where.push('banded edge to the front');
  return say(`${verb} ${label}${meets}: ${where.join(', ')}.`);
}

/** The fittings of a step gathered as someone fits them: one joint, or one kind of hardware on one part. */
function fixes(mp: MakePiece, step: Step, partOf: (i: number) => number): PlanFix[] {
  const groups = new Map<string, number[]>();
  for (const i of step.items) {
    const f = mp.fittings[i]!;
    // The screws that hold a piece of hardware are listed with it, not as a job of their own.
    if (f.purpose === 'fixing' || f.purpose === 'wall-fixing') continue;
    // The back's nails are one job for each back; everything else by the boards it joins or sits on.
    const where = f.kind === 'nail' ? String(f.boards[0]) : f.boards.join('+');
    const key = [f.kind, f.size ?? '', f.purpose ?? '', where].join('|');
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  // In the order the boards go in: each joint is made as soon as the later of its boards is in place.
  const turn = (items: readonly number[]) => Math.max(-1, ...mp.fittings[items[0]!]!.boards.filter(b => step.boards.includes(b)).map(b => mp.sequence.rank[b]!));
  return [...groups.values()].sort((p, q) => turn(p) - turn(q) || p[0]! - q[0]!).map(items => {
    const first = mp.fittings[items[0]!]!, entry = hardware(first.kind), text = entry?.assembly.instructions;
    const boards = first.kind === 'nail' ? [first.boards[0]!] : [...first.boards], held = new Map<string, number>();
    mp.fittings.forEach(f => { if ((f.purpose === 'fixing' || f.purpose === 'wall-fixing') && f.of !== undefined && items.includes(f.of) && f.size) held.set(f.size, (held.get(f.size) ?? 0) + 1); });
    const choice = boards.length === 2 ? mp.joints.find(c => c.joint.face === boards[0] && c.joint.edge === boards[1]) : undefined;
    const note = choice?.instead ? NOTES[choice.instead] : choice?.access === 'closed' ? 'Push the part onto them as it goes in.'
      : first.kind === 'nail' ? 'Into every board behind the back: the sides, the base, the top, the partitions and the fixed shelves.' : undefined;
    const after = first.boards.filter(b => step.boards.includes(b)).sort((p, q) => mp.sequence.rank[q]! - mp.sequence.rank[p]!)[0];
    return {
      kind: first.kind, size: first.size, qty: items.length, items,
      title: text?.title ?? entry?.name ?? first.kind, how: text?.fix ?? text?.place ?? text?.summary ?? '',
      parts: [...new Set(boards.map(partOf))], at: setOut(mp, items.map(i => mp.fittings[i]!), boards, partOf),
      with: [...held].map(([size, qty]) => ({ size, qty })), note, after,
    };
  });
}

/** Where a group of fittings goes on the board they go into or sit on: along the way they are spread, from its low end. */
function setOut(mp: MakePiece, group: readonly Fitting[], boards: readonly number[], partOf: (i: number) => number): PlanSetOut | undefined {
  const on = boards[0], ref = on === undefined ? undefined : mp.boards[on];
  if (on === undefined || !ref || group[0]!.kind === 'nail' || isTilted(ref)) return undefined;
  const t = AX[thinAxis(ref)], across = ([0, 1, 2] as Axis[]).filter(k => k !== t);
  const spread = (k: Axis) => Math.max(...group.map(f => f.at[k])) - Math.min(...group.map(f => f.at[k]));
  // Along the way they are spread; one alone, along the board's length.
  const along = across.reduce((m, k) => spread(k) > spread(m) + 1e-9 || spread(k) === spread(m) && hi(ref)[k] - lo(ref)[k] > hi(ref)[m] - lo(ref)[m] ? k : m, across[0]!);
  const other = across.find(k => k !== along)!, from = (['left end', 'bottom edge', 'back edge'] as const)[along];
  const at = [...new Set(group.map(f => mm(f.at[along] - lo(ref)[along])))].sort((p, q) => p - q);
  // The line they stand on, when they share one: from the front edge through the depth, else from the board's low end.
  const reach = mm(hi(ref)[other] - lo(ref)[other]), back = mm(group[0]!.at[other] - lo(ref)[other]);
  const line = spread(other) > 1e-6 ? undefined : other === 2 ? { from: 'front edge' as const, mm: Math.round((reach - back) * 10) / 10 } : { from: (['left end', 'bottom edge'] as const)[other], mm: back };
  return { on: partOf(on), from, mm: at, line: line && line.mm > .05 && line.mm < reach - .05 ? line : undefined };
}

/** What to measure before going on, with the number to read. */
function checks(mp: MakePiece, step: Step): PlanCheck[] {
  const B = mp.boards, out: PlanCheck[] = [], carcass = B.filter(b => isStructural(b) || isTilted(b));
  const box = (boards: readonly Board[]) => ({ w: Math.max(...boards.map(b => b.x1)) - Math.min(...boards.map(b => b.x0)), h: Math.max(...boards.map(b => b.y1)) - Math.min(...boards.map(b => b.y0)),
    d: Math.max(...boards.map(b => b.z1)) - Math.min(...boards.map(b => b.z0)) });
  if (step.stage === 'plinth') {
    const frame = box(step.boards.map(i => B[i]!));
    out.push({ text: 'The plinth frame is square: its two diagonals measure the same', value: mm(Math.hypot(frame.w, frame.d)), tolerance: 1 });
  }
  if (step.stage === 'partitions') {
    const uprights = step.boards.map(i => B[i]!).concat(carcass.filter(b => thinAxis(b) === 'x' && b.x0 < .05)).filter(b => thinAxis(b) === 'x' && b.y1 - b.y0 > mp.size.h * .4)
      .sort((p, q) => p.x0 - q.x0);
    const bays = uprights.slice(1).map((b, k) => mm(b.x0 - uprights[k]!.x1)).filter(v => v > 0);
    if (bays.length) out.push({ text: 'Clear width of each bay, left to right: ' + bays.join(', ') + ' mm, the same at the front and the back' });
  }
  if (step.stage === 'back' && carcass.length > 1) {
    const size = box(carcass), flat = !B.some(isTilted) && carcass.filter(b => thinAxis(b) === 'y' && b.y1 > mp.size.h - .05).length > 0;
    if (flat) out.push({ text: 'Before the back is fixed the carcass is square: corner to corner, both diagonals measure the same. Push the longer one in until they do',
      value: mm(Math.hypot(size.w, size.h)), tolerance: 1 });
    else out.push({ text: 'Before the back is fixed every upright is plumb: check each with a level, front and side' });
    if (mp.construction.back === 'nailed') out.push({ text: 'Nails no more than 150 mm apart, driven square, none through the face of a board' });
  }
  if (step.stage === 'inside') {
    const rails = step.items.map(i => mp.fittings[i]!).filter(f => f.kind === 'rail' && !f.size?.includes('cargo') && Number(f.size) > 0);
    for (const length of new Set(rails.map(f => Number(f.size)))) out.push({ text: 'Each hanging rail is cut 4 mm shorter than its bay', value: length });
    if (step.boards.some(i => B[i]!.note === 'adjustable')) out.push({ text: 'Each loose shelf rests on four supports at one height and does not rock' });
  }
  if (step.stage === 'drawer-test') out.push({ text: 'Every drawer runs to its stop and closes flush, with the same gap all round its front' });
  if (step.stage === 'doors') {
    for (const gap of new Set(doorGaps(mp).map(m => mm(m.length)))) out.push({ text: 'Doors adjusted on their hinges to an even gap', value: gap, tolerance: .5 });
    out.push({ text: 'Every door closes without touching its neighbour and stays shut' });
  }
  if (step.stage === 'wall') out.push({ text: 'The piece stands level and plumb before it is fixed, and its fixings suit the wall (plug and screw in masonry, a screw into a stud in timber)' });
  return out;
}

function method(mp: MakePiece, options: PlanOptions): PlanMethod {
  const { w, h, d } = mp.size, needs = mm(standUpHeight(h, d)), ceiling = options.ceiling === undefined ? undefined : mm(options.ceiling);
  const floor = [mm(w + 2 * WALK), mm(h + 2 * WALK)] as const, hung = mp.piece.hung;
  if (h < TALL || hung) {
    return { posture: 'bench', standUp: needs, ceiling, floor, text: 'Build it on a bench or a clean floor covered with a blanket or cardboard, in the order of the steps.'
      + (hung ? ' It is hung on the wall last, with a second person to lift it.' : '') };
  }
  if (ceiling !== undefined && needs > ceiling) {
    return { posture: 'standing', standUp: needs, ceiling, floor, text: `Build it standing where it goes. Lying down it could not be stood up: turning upright it needs ${needs} mm`
      + ` (its diagonal across height and depth), and the ceiling is ${ceiling} mm. Every joint in the steps can be made standing: none is screwed from underneath.` };
  }
  return { posture: 'lying', standUp: needs, ceiling, floor, text: `Build the carcass lying on its front edges on a blanket or cardboard, on a floor at least ${floor[0]} × ${floor[1]} mm clear,`
    + ` up to and including the back. Then stand it up with a second person: turning upright it needs ${needs} mm of height`
    + (ceiling === undefined ? ' (its diagonal across height and depth), so measure the ceiling first.' : `, and the ceiling is ${ceiling} mm.`)
    + ' Everything after the back is done with it standing in place.' };
}

/** What the piece's own hardware and holes call for, and what every piece needs. */
function tools(mp: MakePiece): string[] {
  const has = (test: (f: Fitting) => boolean) => mp.fittings.some(test), bits = [...new Set(mp.holes.map(h => h.d))].sort((p, q) => p - q);
  const category = (f: Fitting) => hardware(f.kind)?.category;
  return [
    'Tape measure, pencil and a square',
    ...(bits.length ? ['Drill with bits Ø ' + bits.join(', ') + ' mm, and a depth stop for the blind holes'] : []),
    ...(has(f => f.kind === 'confirmat') ? ['4 mm hex key or bit for the connector screws'] : []),
    ...(has(f => f.kind === 'screw' || category(f) === 'hinge' || f.kind === 'cam') ? ['Cross-head (PZ2) screwdriver or driver bit'] : []),
    ...(has(f => f.kind === 'nail' || f.kind === 'dowel') ? ['Hammer'] : []),
    ...(has(f => f.kind === 'dowel' && !f.purpose) ? ['Wood glue for the dowels'] : []),
    ...(mp.size.h >= TALL || has(f => category(f) === 'bracket') ? ['Spirit level'] : []),
    'A blanket or cardboard to work on',
  ];
}

/** The plan for building `mp`: see the head of this file. */
export function assemblyPlan(mp: MakePiece, options: PlanOptions = {}): AssemblyPlan {
  const partOf = (i: number) => mp.parts.find(p => p.ids.includes(i))?.n ?? 0, tall = mp.size.h >= TALL || mp.size.w >= TALL;
  // Lifting a long board into place or hanging a tall door takes two; fitting hardware one.
  const heavy = (step: Step) => step.boards.some(i => { const b = mp.boards[i]!; return b.cut.length >= TALL && (isStructural(b) || isTilted(b) || b.stock === 'back' || b.stock === 'door'); });
  const steps = mp.steps.map((step): PlanStep => {
    const spec = assemblyStageSpec(step.stage), fitted = step.items.reduce((s, i) => s + fitMinutes(mp.fittings[i]!.kind), 0);
    return {
      n: step.n, stage: step.stage, title: spec?.title ?? step.stage, summary: spec?.summary ?? '', parts: partsOf(mp, step),
      places: step.boards.map(i => place(mp, i, step.stage, partOf)), fixes: fixes(mp, step, partOf), checks: checks(mp, step),
      minutes: Math.max(1, Math.round(step.boards.length * BOARD_MINUTES + fitted)), people: heavy(step) || step.stage === 'wall' && tall ? 2 : 1,
    };
  });
  return { method: method(mp, options), people: tall || steps.some(s => s.people === 2) ? 2 : 1, minutes: steps.reduce((s, x) => s + x.minutes, 0), tools: tools(mp), steps };
}
