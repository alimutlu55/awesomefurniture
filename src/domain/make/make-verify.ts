import type { Board } from '../drawings/cabinet-boards';
import { MIN_WALL } from './bore-clearance';
import { fixingMisfit, screwLength } from './make-fixings';
import type { Fitting, Hole } from './make-joints';
import type { MakePiece } from './make-parts';
import { isTilted } from './make-joints';
import { thinAxis } from './make-measures';
import { isStructural } from './make-sequence';

/**
 * Whether a piece can be built as Make sets it out, proved on the piece itself every time, not assumed from tests.
 * Each check is a closure that must hold exactly: every board is cut to the size it occupies, belongs to one part and
 * one step, and is held by something; every connector's holes line up and it reaches far enough into the board behind;
 * every screw stays inside the board it is driven into; nothing is drilled into anything else; every joint can be made
 * in the order the steps give; everything fitted is on the buy list, once. A piece with any defect must not reach an
 * assembly bench: the engine turns each into a blocking finding (engine/rules/buildability-pack.ts).
 *
 * It works from the boards, fittings and holes alone, so a piece nobody has drawn before is checked like any other.
 * Millimetres in what it reports.
 */

export type DefectKind =
  /** A board's cutting size is not the size it occupies, or not a real size. */
  | 'cut-size'
  /** A board, fitting or hole is counted twice or not at all somewhere (parts, steps, the buy list). */
  | 'count'
  /** A board nothing holds. */
  | 'unheld'
  /** A board held at one point only: it can turn. */
  | 'loose'
  /** A front that moves with nothing to move on. */
  | 'mechanism'
  /** A connector whose holes do not line up, or that does not reach, or reaches too far. */
  | 'connector'
  /** A screw that comes out of the board it is driven into, or a bolt too short for it. */
  | 'fastener'
  /** Drilling that cannot be made: bores running into each other, out of the board or through its far face. */
  | 'bore'
  /** A joint that can be neither screwed nor closed in the build order. */
  | 'joint'
  /** Hardware fitted in a step before the board it goes on is there. */
  | 'order';

export interface BuildDefect {
  readonly kind: DefectKind;
  /** The board it is on, by its place in the piece's board list. */
  readonly board?: number | undefined;
  /** What is wrong, without the piece's mark ("Shelf is held at one point only"). */
  readonly what: string;
  /** The rule it breaks. */
  readonly why: string;
  readonly measured?: number | undefined;
  readonly limit?: number | undefined;
}

const AX = { x: 0, y: 1, z: 2 } as const;
const mm = (cm: number) => Number((cm * 10).toPrecision(12));
/** A connector screw holds from this much thread in the board behind. */
const MIN_HOLD = { confirmat: 20, screw: 15 } as const;
/** Fasteners that join boards: both boards must be there when they go in. */
const JOINING: ReadonlySet<Fitting['kind']> = new Set(['confirmat', 'dowel', 'cam', 'nail']);
const CONNECTORS: ReadonlySet<Fitting['kind']> = new Set(['confirmat', 'dowel', 'bolt', 'screw']);

function cutSizes(mp: MakePiece, out: BuildDefect[]) {
  mp.boards.forEach((b, i) => {
    const cut = [b.cut.length, b.cut.width, b.cut.thickness];
    if (!cut.every(v => Number.isFinite(v) && v > 0)) { out.push({ kind: 'cut-size', board: i, what: b.name + ' has no real cutting size', why: 'Every board has a length, a width and a thickness.' }); return; }
    if (b.outline) return;
    const extent = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0].sort((p, q) => p - q), sorted = [...cut].sort((p, q) => p - q);
    const off = Math.max(...sorted.map((v, k) => Math.abs(v - extent[k]!)));
    if (off > 1e-7) out.push({ kind: 'cut-size', board: i, what: b.name + ' is cut ' + cut.map(mm).join(' × ') + ' mm but stands ' + extent.reverse().map(mm).join(' × ') + ' mm',
      why: 'A board is cut to exactly the size it takes up in the piece.', measured: mm(off), limit: 0 });
  });
}

function counts(mp: MakePiece, out: BuildDefect[]) {
  const once = (label: string, seen: readonly number[], total: number, name: (i: number) => string) => {
    const n = new Map<number, number>();
    for (const i of seen) n.set(i, (n.get(i) ?? 0) + 1);
    for (let i = 0; i < total; i++) if (n.get(i) !== 1) out.push({ kind: 'count', what: name(i) + ' is in ' + (n.get(i) ?? 0) + ' ' + label, why: 'Everything is counted once: in one part, one step, one line to buy.', measured: n.get(i) ?? 0, limit: 1 });
  };
  once('parts', mp.parts.flatMap(p => p.ids), mp.boards.length, i => mp.boards[i]!.name);
  once('steps', mp.steps.flatMap(s => s.boards), mp.boards.length, i => mp.boards[i]!.name);
  once('steps', mp.steps.flatMap(s => s.items), mp.fittings.length, i => 'The ' + mp.fittings[i]!.kind);
  const bought = mp.buy.reduce((s, l) => s + l.qty, 0), stepped = mp.steps.reduce((s, st) => s + st.fittings.reduce((a, f) => a + f.qty, 0), 0);
  if (bought !== mp.fittings.length || stepped !== mp.fittings.length) out.push({ kind: 'count', what: 'The buy list has ' + bought + ' pieces of hardware and the steps fit ' + stepped + '; the piece has ' + mp.fittings.length,
    why: 'What is bought, what the steps fit and what the piece is made with are one number.', measured: bought, limit: mp.fittings.length });
  for (const p of mp.parts) for (const b of p.boards) {
    if (mm(b.cut.length) !== mm(p.cut.length) || mm(b.cut.width) !== mm(p.cut.width) || mm(b.cut.thickness) !== mm(p.cut.thickness))
      out.push({ kind: 'count', what: 'Part ' + p.n + ' ' + p.name + ' groups boards of different sizes', why: 'A part number is one size.' });
  }
  mp.holes.forEach(h => { if (h.of !== undefined && !mp.fittings[h.of]) out.push({ kind: 'count', board: h.board, what: 'A hole in ' + mp.boards[h.board]!.name + ' is drilled for hardware that is not there', why: 'Every hole is drilled for something that is fitted.' }); });
}

function held(mp: MakePiece, out: BuildDefect[]) {
  const B = mp.boards, naming = (i: number, test: (f: Fitting) => boolean) => mp.fittings.filter(f => f.boards.includes(i) && test(f)).length;
  const drawerOf = (i: number) => mp.drawers.find(d => [d.front, d.applied, d.back, d.bottom, ...d.sides].includes(i));
  const unheld = (i: number, what: string, why: string) => out.push({ kind: 'unheld', board: i, what, why });
  const loose = (i: number, n: number) => out.push({ kind: 'loose', board: i, what: B[i]!.name + ' is held at one point only', why: 'A board held by one connector can turn about it: every board is held at two points or more.', measured: n, limit: 2 });
  for (const d of mp.drawers) {
    if (!mp.fittings.some(f => f.runner?.moving.includes(d.sides[0]))) out.push({ kind: 'mechanism', board: d.front, what: 'A drawer has no runners', why: 'A drawer slides on a pair of runners.' });
  }
  B.forEach((b, i) => {
    const d = drawerOf(i);
    if (d) {
      if (i === d.bottom) {
        const grooved = new Set(mp.grooves.filter(g => [d.front, d.back, ...d.sides].includes(g.board) && g.lo[1] < b.y1 + .01 && g.hi[1] > b.y0 - .01).map(g => g.board)).size;
        if (grooved < 3) unheld(i, 'A drawer bottom is not captured in its box', 'A drawer bottom sits in a groove in the front, both sides and the back.');
      } else if (i === d.applied) { const n = naming(i, f => f.purpose === 'drawer-front'); if (n < 2) (n ? loose(i, n) : unheld(i, b.name + ' is not fixed to its drawer', 'A front is screwed on from inside its drawer box.')); }
      else { const n = naming(i, f => f.kind === 'bolt' || f.kind === 'dowel' || f.kind === 'cam'); if (n < 2) (n ? loose(i, n) : unheld(i, b.name + ' is not joined to its drawer', 'Every board of a drawer box is joined to the next.')); }
      return;
    }
    if (b.note === 'drawer box') { unheld(i, b.name + ' belongs to no drawer', 'A drawer is a front, two sides, a back and a bottom.'); return; }
    if (b.stock === 'back') {
      const nails = naming(i, f => f.kind === 'nail'), hosts = new Set(mp.grooves.filter(g => ([0, 1, 2] as const).every(k => g.lo[k] < [b.x1, b.y1, b.z1][k]! + .01 && g.hi[k] > [b.x0, b.y0, b.z0][k]! - .01)).map(g => g.board)).size;
      if (mp.construction.back === 'grooved' ? hosts < 3 : nails < 4) unheld(i, 'The back is not fixed', mp.construction.back === 'grooved' ? 'A back slides into a groove in at least three of the boards round it.' : 'A back is nailed into the boards round it.');
      return;
    }
    if (b.note === 'adjustable') { const pins = naming(i, f => f.kind === 'pin'); if (pins < 4) unheld(i, 'A loose shelf rests on ' + pins + ' supports', 'A loose shelf rests on four supports.'); return; }
    if (b.stock === 'door' || b.stock === 'front') {
      const hinges = mp.fittings.filter(f => f.kind === 'hinge' && f.boards[0] === i);
      if (hinges.length) {
        if (hinges.some(f => f.boards.length < 2)) unheld(i, b.name + ' has no upright to hang from', 'A door hangs from the upright its hinge plates are screwed to.');
        else if (hinges.length < 2) loose(i, hinges.length);
        return;
      }
      if (naming(i, f => !!f.cargo || f.kind === 'liftFitting' || f.kind === 'applianceKit')) return;
      const screws = naming(i, f => f.purpose === 'front-fixing');
      if (screws >= 2) return;
      if (mp.motions[i]?.kind === 'slide') out.push({ kind: 'mechanism', board: i, what: b.name + ' pulls out but has nothing to slide on', why: 'A pull-out front is carried by runners or a pull-out frame; none is set out for this one yet.' });
      else unheld(i, b.name + ' is not fixed to anything', 'A front is hung on hinges, carried by its drawer or mechanism, or screwed on.');
      return;
    }
    // A carcass or plinth board: joined to the boards it meets, or (a piece of one board) fixed where it is installed.
    const joined = naming(i, f => CONNECTORS.has(f.kind) && f.purpose !== 'fixing' && f.purpose !== 'wall-fixing' && f.boards.length > 1 || f.purpose === 'front-fixing' || f.kind === 'shelfBracket');
    if (joined < 2 && (isStructural(b) || isTilted(b) || b.stock === 'plinth' || b.stock === 'shelf')) (joined ? loose(i, joined) : unheld(i, b.name + ' is joined to nothing', 'Every board is joined to the boards it meets.'));
  });
}

function connectors(mp: MakePiece, out: BuildDefect[]) {
  const B = mp.boards, of = new Map<number, Hole[]>();
  for (const h of mp.holes) if (h.of !== undefined) of.set(h.of, [...(of.get(h.of) ?? []), h]);
  const bad = (board: number, what: string, why: string, measured?: number, limit?: number) => out.push({ kind: 'connector', board, what, why, measured, limit });
  const inLine = (a: Hole, b: Hole) => a.axis === b.axis && ([0, 1, 2] as const).filter(k => k !== a.axis).every(k => Math.abs(a.at[k] - b.at[k]) < 1e-7);
  mp.fittings.forEach((f, i) => {
    const hs = of.get(i) ?? [];
    if ((f.kind === 'confirmat' || f.kind === 'screw') && f.boards.length === 2 && !f.purpose) {
      const face = hs.find(h => h.board === f.boards[0] && h.depth === 0), pilot = hs.find(h => h.kind === 'pilot');
      if (!face || !pilot) { bad(f.boards[0]!, 'A screw joining ' + B[f.boards[0]!]!.name + ' and ' + B[f.boards[1]!]!.name + ' has no hole set out for it', 'A connector screw goes through one board into a pilot hole in the end of the other.'); return; }
      if (!inLine(face, pilot)) bad(pilot.board, 'The pilot hole in ' + B[pilot.board]!.name + ' is not in line with its screw', 'A screw and its pilot hole share one centre line.');
      const length = screwLength(f.size ?? ''), through = mm(Math.abs(face.at[face.axis] - pilot.at[pilot.axis]));
      if (length === null) return;
      const hold = length - through, least = MIN_HOLD[f.kind];
      if (hold < least - 1e-9) bad(pilot.board, 'A ' + f.size + ' screw goes only ' + hold + ' mm into ' + B[pilot.board]!.name, 'A connector screw holds from ' + least + ' mm of thread in the board behind.', hold, least);
      if (hold > pilot.depth + 1e-9) bad(pilot.board, 'A ' + f.size + ' screw goes ' + hold + ' mm into a ' + pilot.depth + ' mm pilot hole in ' + B[pilot.board]!.name, 'A pilot hole is as deep as its screw goes.', hold, pilot.depth);
    } else if (f.kind === 'dowel' && f.boards.length === 2) {
      const [a, b] = hs, length = screwLength(f.size ?? '');
      if (!a || !b) { bad(f.boards[0]!, 'A dowel joining ' + B[f.boards[0]!]!.name + ' and ' + B[f.boards[1]!]!.name + ' has no holes set out for it', 'A dowel sits in a hole in each board.'); return; }
      // A dowel hammered through one board (a drawer back) sits in the same line, one hole behind the other.
      if (!inLine(a, b)) bad(b.board, 'The dowel holes in ' + B[a.board]!.name + ' and ' + B[b.board]!.name + ' are not in line', 'The two holes of a dowel share one centre line.');
      const room = (h: Hole) => h.depth > 0 ? h.depth : mm(B[h.board]!.cut.thickness);
      if (length !== null && room(a) + room(b) < length - 1e-9) bad(b.board, 'A ' + f.size + ' dowel has only ' + (room(a) + room(b)) + ' mm of hole', 'The two holes of a dowel are together at least as deep as it is long.', room(a) + room(b), length);
    } else if (f.kind === 'cam') {
      const housing = hs.find(h => h.kind === 'cam'), channel = hs.find(h => h.kind === 'pilot');
      if (!housing || !channel) { bad(f.boards[1] ?? f.boards[0]!, 'A cam has no housing or bolt channel set out for it', 'A cam sits in a housing that its bolt reaches through a channel from the board\'s end.'); return; }
      const reach = mm(Math.abs(housing.at[channel.axis] - channel.at[channel.axis]));
      if (Math.abs(reach - channel.depth) > 1e-6) bad(housing.board, 'A cam housing in ' + B[housing.board]!.name + ' is ' + reach + ' mm from the joint; its bolt reaches ' + channel.depth + ' mm', 'A cam sits where its bolt\'s head arrives.', reach, channel.depth);
    }
  });
  // A hole run into a board's edge keeps board either side of it.
  for (const h of mp.holes) {
    const b = B[h.board]!, t = AX[thinAxis(b)];
    if (h.axis === t || b.outline || isTilted(b)) continue;
    const lo = [b.x0, b.y0, b.z0][t]!, hi = [b.x1, b.y1, b.z1][t]!, wall = mm(Math.min(h.at[t] - lo, hi - h.at[t])) - h.d / 2;
    if (wall < MIN_WALL - 1e-9) bad(h.board, 'A ' + h.d + ' mm hole in the edge of ' + b.name + ' leaves ' + Number(wall.toPrecision(6)) + ' mm of board beside it', 'A hole in an edge keeps at least ' + MIN_WALL + ' mm of board either side.', Number(wall.toPrecision(6)), MIN_WALL);
  }
}

function fasteners(mp: MakePiece, out: BuildDefect[]) {
  const B = mp.boards, thick = (i: number) => mm(B[i]!.cut.thickness);
  mp.fittings.forEach(f => {
    if (f.kind !== 'screw' || !f.size || f.boards.length === 0) return;
    const say = (board: number, fit: NonNullable<ReturnType<typeof fixingMisfit>>) => out.push({ kind: 'fastener', board,
      what: fit.kind === 'through' ? 'A ' + f.size + ' screw comes ' + fit.by + ' mm out of the far face of ' + B[board]!.name : 'A ' + f.size + ' bolt is ' + fit.by + ' mm short for ' + B[board]!.name,
      why: fit.kind === 'through' ? 'A screw stays inside the board it is driven into.' : 'A bolt through a front keeps 5 mm of thread for what it holds.', measured: fit.by, limit: 0 });
    if (f.purpose === 'fixing' || f.purpose === 'runner-mount' || f.purpose === 'drawer-front' && f.boards.length === 1) {
      const fit = fixingMisfit(f.size, thick(f.boards[0]!));
      if (fit) say(f.boards[0]!, fit);
    } else if (f.purpose === 'drawer-front' && f.boards.length === 2) {
      // Through the box front, into the applied front behind it.
      const length = screwLength(f.size), into = length === null ? 0 : length - thick(f.boards[0]!);
      if (into > thick(f.boards[1]!) - 1) say(f.boards[1]!, { kind: 'through', by: Number((into - (thick(f.boards[1]!) - 1)).toPrecision(6)) });
    }
  });
}

function order(mp: MakePiece, out: BuildDefect[]) {
  const boardStep = new Map<number, number>(), B = mp.boards;
  mp.steps.forEach((s, k) => s.boards.forEach(b => boardStep.set(b, k)));
  mp.steps.forEach((s, k) => s.items.forEach(i => {
    const f = mp.fittings[i]!;
    // What joins two boards needs both; a box's bolts go into its front before the sides come (drawer-box.ts).
    if (!JOINING.has(f.kind) && !(f.kind === 'screw' && !f.purpose) || f.purpose === 'box-front') return;
    for (const b of f.boards) if ((boardStep.get(b) ?? 0) > k) out.push({ kind: 'order', board: b, what: 'A ' + f.kind + ' is fitted in step ' + (k + 1) + ', before ' + B[b]!.name + ' is there (step ' + ((boardStep.get(b) ?? 0) + 1) + ')',
      why: 'Hardware goes in when the boards it joins are in place.' });
  }));
  // Every joint can be made when the later of its boards goes in (make-sequence.ts decides how).
  for (const c of mp.joints) {
    if (c.stuck) out.push({ kind: 'joint', board: c.joint.edge, what: B[c.joint.edge]!.name + ' cannot be joined to ' + B[c.joint.face]!.name + ': its screws cannot be reached and it cannot travel onto dowels',
      why: 'Every joint can be screwed or closed when its board goes in.' });
  }
}

function drilling(mp: MakePiece, out: BuildDefect[]) {
  const what = { clash: 'two holes run into each other', meet: 'holes from both faces meet inside the board', breakout: 'a hole breaks out of the far face', edge: 'a hole is drilled outside the board' } as const;
  const why = { clash: 'Bores keep at least ' + MIN_WALL + ' mm of board between them.', meet: 'Two blind holes drilled towards each other must not meet.', breakout: 'A blind hole stops inside the board.', edge: 'A hole is drilled in the board, not past its edge.' } as const;
  for (const f of mp.findings) {
    // A hole near an edge but inside the board is something to look at, not something that cannot be made.
    if (f.kind === 'edge' && f.gap >= 0) continue;
    out.push({ kind: 'bore', board: f.board, what: mp.boards[f.board]!.name + ': ' + what[f.kind] + ' (' + f.gap + ' mm)', why: why[f.kind], measured: f.gap, limit: f.kind === 'clash' ? MIN_WALL : 0 });
  }
}

/** Everything that stops `mp` being built as set out; empty when it can be. */
export function verifyPiece(mp: MakePiece): BuildDefect[] {
  const out: BuildDefect[] = [];
  cutSizes(mp, out); counts(mp, out); held(mp, out); connectors(mp, out); fasteners(mp, out); drilling(mp, out); order(mp, out);
  return out;
}

/** Whether a board of the piece is one the checks above treat as a carcass board (for callers that explain them). */
export const isCarcassBoard = (b: Board) => isStructural(b) || isTilted(b);
