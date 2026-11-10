import { hardware } from '../hardware/hardware-registry';
import { MIN_WALL } from './bore-clearance';
import { fixingMisfit, screwLength } from './make-fixings';
import { type Fitting, type Hole, isTilted } from './make-joints';
import type { MakePiece } from './make-parts';
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
const tidy = (v: number) => Number(v.toPrecision(6));
/** A connector screw holds from this much thread in the board behind. */
const MIN_HOLD = { confirmat: 20, screw: 15 } as const;
/** What joins two boards, so that both must be there when it goes in: a connector, a nail, a plain screw. */
const joins = (f: Fitting) => hardware(f.kind)?.category === 'connector' || f.kind === 'nail' || f.kind === 'screw' && !f.purpose;
/** One connector of a joint between two boards, counted once (a cam and its bolt are one): what holds a carcass board. */
const connects = (f: Fitting) => f.boards.length > 1 && f.purpose !== 'fixing' && f.purpose !== 'wall-fixing'
  && (hardware(f.kind)?.category === 'connector' && f.kind !== 'cam' || f.kind === 'screw');

type Report = (defect: BuildDefect) => void;

function cutSizes(mp: MakePiece, report: Report) {
  mp.boards.forEach((b, i) => {
    const cut = [b.cut.length, b.cut.width, b.cut.thickness];
    if (!cut.every(v => Number.isFinite(v) && v > 0)) {
      report({ kind: 'cut-size', board: i, what: b.name + ' has no real cutting size', why: 'Every board has a length, a width and a thickness.' });
      return;
    }
    if (b.outline) return;
    const extent = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0].sort((p, q) => p - q), sorted = [...cut].sort((p, q) => p - q);
    const off = Math.max(...sorted.map((v, k) => Math.abs(v - extent[k]!)));
    if (off <= 1e-7) return;
    report({ kind: 'cut-size', board: i, measured: mm(off), limit: 0, why: 'A board is cut to exactly the size it takes up in the piece.',
      what: b.name + ' is cut ' + cut.map(mm).join(' × ') + ' mm but stands ' + extent.reverse().map(mm).join(' × ') + ' mm' });
  });
}

function counts(mp: MakePiece, report: Report) {
  const why = 'Everything is counted once: in one part, one step, one line to buy.';
  const once = (label: string, seen: readonly number[], total: number, name: (i: number) => string) => {
    const n = new Map<number, number>();
    for (const i of seen) n.set(i, (n.get(i) ?? 0) + 1);
    for (let i = 0; i < total; i++) {
      if (n.get(i) !== 1) report({ kind: 'count', what: name(i) + ' is in ' + (n.get(i) ?? 0) + ' ' + label, why, measured: n.get(i) ?? 0, limit: 1 });
    }
  };
  once('parts', mp.parts.flatMap(p => p.ids), mp.boards.length, i => mp.boards[i]!.name);
  once('steps', mp.steps.flatMap(s => s.boards), mp.boards.length, i => mp.boards[i]!.name);
  once('steps', mp.steps.flatMap(s => s.items), mp.fittings.length, i => 'The ' + mp.fittings[i]!.kind);
  const total = mp.fittings.length, bought = mp.buy.reduce((s, l) => s + l.qty, 0);
  const stepped = mp.steps.reduce((s, st) => s + st.fittings.reduce((a, f) => a + f.qty, 0), 0);
  if (bought !== total || stepped !== total) {
    report({ kind: 'count', measured: bought, limit: total, why: 'What is bought, what the steps fit and what the piece is made with are one number.',
      what: 'The buy list has ' + bought + ' pieces of hardware and the steps fit ' + stepped + '; the piece has ' + total });
  }
  const same = (a: number, b: number) => mm(a) === mm(b);
  for (const p of mp.parts) for (const b of p.boards) {
    if (same(b.cut.length, p.cut.length) && same(b.cut.width, p.cut.width) && same(b.cut.thickness, p.cut.thickness)) continue;
    report({ kind: 'count', what: 'Part ' + p.n + ' ' + p.name + ' groups boards of different sizes', why: 'A part number is one size.' });
  }
  for (const h of mp.holes) {
    if (h.of === undefined || mp.fittings[h.of]) continue;
    report({ kind: 'count', board: h.board, what: 'A hole in ' + mp.boards[h.board]!.name + ' is drilled for hardware that is not there',
      why: 'Every hole is drilled for something that is fitted.' });
  }
}

function held(mp: MakePiece, report: Report) {
  const B = mp.boards, naming = (i: number, test: (f: Fitting) => boolean) => mp.fittings.filter(f => f.boards.includes(i) && test(f)).length;
  const drawerOf = (i: number) => mp.drawers.find(d => [d.front, d.applied, d.back, d.bottom, ...d.sides].includes(i));
  const unheld = (i: number, what: string, why: string) => report({ kind: 'unheld', board: i, what, why });
  const loose = (i: number, n: number) => report({ kind: 'loose', board: i, what: B[i]!.name + ' is held at one point only', measured: n, limit: 2,
    why: 'A board held by one connector can turn about it: every board is held at two points or more.' });
  /** Held at two points or more, at one (loose), or not at all. */
  const atTwo = (i: number, n: number, what: string, why: string) => { if (n >= 2) return; if (n) loose(i, n); else unheld(i, what, why); };
  for (const d of mp.drawers) {
    if (mp.fittings.some(f => f.runner?.moving.includes(d.sides[0]))) continue;
    report({ kind: 'mechanism', board: d.front, what: 'A drawer has no runners', why: 'A drawer slides on a pair of runners.' });
  }
  B.forEach((b, i) => {
    const d = drawerOf(i), lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
    if (d) {
      if (i === d.bottom) {
        const round = [d.front, d.back, ...d.sides];
        const grooved = new Set(mp.grooves.filter(g => round.includes(g.board) && g.lo[1] < b.y1 + .01 && g.hi[1] > b.y0 - .01).map(g => g.board)).size;
        if (grooved < 3) unheld(i, 'A drawer bottom is not captured in its box', 'A drawer bottom sits in a groove in the front, both sides and the back.');
      } else if (i === d.applied) {
        atTwo(i, naming(i, f => f.purpose === 'drawer-front'), b.name + ' is not fixed to its drawer', 'A front is screwed on from inside its drawer box.');
      } else {
        const n = naming(i, f => f.kind === 'bolt' || f.kind === 'dowel' || f.kind === 'cam');
        atTwo(i, n, b.name + ' is not joined to its drawer', 'Every board of a drawer box is joined to the next.');
      }
      return;
    }
    if (b.note === 'drawer box') { unheld(i, b.name + ' belongs to no drawer', 'A drawer is a front, two sides, a back and a bottom.'); return; }
    if (b.stock === 'back') {
      const grooved = mp.construction.back === 'grooved', nails = naming(i, f => f.kind === 'nail');
      const round = mp.grooves.filter(g => ([0, 1, 2] as const).every(k => g.lo[k] < hi[k]! + .01 && g.hi[k] > lo[k]! - .01));
      const why = grooved ? 'A back slides into a groove in at least three of the boards round it.' : 'A back is nailed into the boards round it.';
      if (grooved ? new Set(round.map(g => g.board)).size < 3 : nails < 4) unheld(i, 'The back is not fixed', why);
      return;
    }
    if (b.note === 'adjustable') {
      const pins = naming(i, f => f.kind === 'pin');
      if (pins < 4) unheld(i, 'A loose shelf rests on ' + pins + ' supports', 'A loose shelf rests on four supports.');
      return;
    }
    if (b.stock === 'door' || b.stock === 'front') {
      const hinges = mp.fittings.filter(f => f.kind === 'hinge' && f.boards[0] === i);
      if (hinges.length) {
        if (hinges.some(f => f.boards.length < 2)) unheld(i, b.name + ' has no upright to hang from', 'A door hangs from the upright its hinge plates are screwed to.');
        else if (hinges.length < 2) loose(i, hinges.length);
        return;
      }
      if (naming(i, f => !!f.cargo || f.kind === 'liftFitting' || f.kind === 'applianceKit')) return;
      if (naming(i, f => f.purpose === 'front-fixing') >= 2) return;
      if (mp.motions[i]?.kind === 'slide') {
        report({ kind: 'mechanism', board: i, what: b.name + ' pulls out but has nothing to slide on',
          why: 'A pull-out front is carried by runners or a pull-out frame; none is set out for this one yet.' });
      } else unheld(i, b.name + ' is not fixed to anything', 'A front is hung on hinges, carried by its drawer or mechanism, or screwed on.');
      return;
    }
    // A carcass or plinth board: joined to the boards it meets, or (a piece of one board) fixed where it is installed.
    if (!isStructural(b) && !isTilted(b) && b.stock !== 'plinth' && b.stock !== 'shelf') return;
    const joined = naming(i, f => connects(f) || f.purpose === 'front-fixing' || f.kind === 'shelfBracket');
    atTwo(i, joined, b.name + ' is joined to nothing', 'Every board is joined to the boards it meets.');
  });
}

const RULE = {
  screwHoles: 'A connector screw goes through one board into a pilot hole in the end of the other.',
  screwLine: 'A screw and its pilot hole share one centre line.',
  pilotDepth: 'A pilot hole is as deep as its screw goes.',
  dowelHoles: 'A dowel sits in a hole in each board.',
  dowelLine: 'The two holes of a dowel share one centre line.',
  dowelRoom: 'The two holes of a dowel are together at least as deep as it is long.',
  camHoles: 'A cam sits in a housing that its bolt reaches through a channel from the board\'s end.',
  camReach: 'A cam sits where its bolt\'s head arrives.',
  edgeWall: 'A hole in an edge keeps at least ' + MIN_WALL + ' mm of board either side.',
} as const;

function connectors(mp: MakePiece, report: Report) {
  const B = mp.boards, of = new Map<number, Hole[]>(), name = (i: number) => B[i]!.name;
  for (const h of mp.holes) if (h.of !== undefined) of.set(h.of, [...(of.get(h.of) ?? []), h]);
  const bad = (board: number, what: string, why: string, measured?: number, limit?: number) => report({ kind: 'connector', board, what, why, measured, limit });
  const inLine = (a: Hole, b: Hole) => a.axis === b.axis && ([0, 1, 2] as const).filter(k => k !== a.axis).every(k => Math.abs(a.at[k] - b.at[k]) < 1e-7);
  mp.fittings.forEach((f, i) => {
    const hs = of.get(i) ?? [], between = () => name(f.boards[0]!) + ' and ' + name(f.boards[1]!);
    if ((f.kind === 'confirmat' || f.kind === 'screw') && f.boards.length === 2 && !f.purpose) {
      const face = hs.find(h => h.board === f.boards[0] && h.depth === 0), pilot = hs.find(h => h.kind === 'pilot');
      if (!face || !pilot) { bad(f.boards[0]!, 'A screw joining ' + between() + ' has no hole set out for it', RULE.screwHoles); return; }
      if (!inLine(face, pilot)) bad(pilot.board, 'The pilot hole in ' + name(pilot.board) + ' is not in line with its screw', RULE.screwLine);
      const length = screwLength(f.size ?? ''), through = mm(Math.abs(face.at[face.axis] - pilot.at[pilot.axis]));
      if (length === null) return;
      const hold = tidy(length - through), least = MIN_HOLD[f.kind], where = name(pilot.board);
      if (hold < least - 1e-9) {
        bad(pilot.board, 'A ' + f.size + ' screw goes only ' + hold + ' mm into ' + where, 'A connector screw holds from ' + least + ' mm of thread in the board behind.', hold, least);
      }
      if (hold > pilot.depth + 1e-9) bad(pilot.board, 'A ' + f.size + ' screw goes ' + hold + ' mm into a ' + pilot.depth + ' mm pilot hole in ' + where, RULE.pilotDepth, hold, pilot.depth);
    } else if (f.kind === 'dowel' && f.boards.length === 2) {
      const [a, b] = hs, length = screwLength(f.size ?? '');
      if (!a || !b) { bad(f.boards[0]!, 'A dowel joining ' + between() + ' has no holes set out for it', RULE.dowelHoles); return; }
      // A dowel hammered through one board (a drawer back) sits in the same line, one hole behind the other.
      if (!inLine(a, b)) bad(b.board, 'The dowel holes in ' + name(a.board) + ' and ' + name(b.board) + ' are not in line', RULE.dowelLine);
      const room = (h: Hole) => h.depth > 0 ? h.depth : mm(B[h.board]!.cut.thickness), both = tidy(room(a) + room(b));
      if (length !== null && both < length - 1e-9) bad(b.board, 'A ' + f.size + ' dowel has only ' + both + ' mm of hole', RULE.dowelRoom, both, length);
    } else if (f.kind === 'cam') {
      const housing = hs.find(h => h.kind === 'cam'), channel = hs.find(h => h.kind === 'pilot');
      if (!housing || !channel) { bad(f.boards[1] ?? f.boards[0]!, 'A cam has no housing or bolt channel set out for it', RULE.camHoles); return; }
      const reach = mm(Math.abs(housing.at[channel.axis] - channel.at[channel.axis]));
      if (Math.abs(reach - channel.depth) <= 1e-6) return;
      bad(housing.board, 'A cam housing in ' + name(housing.board) + ' is ' + reach + ' mm from the joint; its bolt reaches ' + channel.depth + ' mm', RULE.camReach, reach, channel.depth);
    }
  });
  // A hole run into a board's edge keeps board either side of it.
  for (const h of mp.holes) {
    const b = B[h.board]!, t = AX[thinAxis(b)];
    if (h.axis === t || b.outline || isTilted(b)) continue;
    const lo = [b.x0, b.y0, b.z0][t]!, hi = [b.x1, b.y1, b.z1][t]!, wall = tidy(mm(Math.min(h.at[t] - lo, hi - h.at[t])) - h.d / 2);
    if (wall >= MIN_WALL - 1e-9) continue;
    bad(h.board, 'A ' + h.d + ' mm hole in the edge of ' + b.name + ' leaves ' + wall + ' mm of board beside it', RULE.edgeWall, wall, MIN_WALL);
  }
}

function fasteners(mp: MakePiece, report: Report) {
  const B = mp.boards, thick = (i: number) => mm(B[i]!.cut.thickness);
  for (const f of mp.fittings) {
    if (f.kind !== 'screw' || !f.size || f.boards.length === 0) continue;
    const say = (board: number, fit: NonNullable<ReturnType<typeof fixingMisfit>>) => {
      const through = fit.kind === 'through', where = B[board]!.name;
      report({ kind: 'fastener', board, measured: fit.by, limit: 0,
        what: through ? 'A ' + f.size + ' screw comes ' + fit.by + ' mm out of the far face of ' + where : 'A ' + f.size + ' bolt is ' + fit.by + ' mm short for ' + where,
        why: through ? 'A screw stays inside the board it is driven into.' : 'A bolt through a front keeps 5 mm of thread for what it holds.' });
    };
    if (f.purpose === 'fixing' || f.purpose === 'runner-mount' || f.purpose === 'drawer-front' && f.boards.length === 1) {
      const fit = fixingMisfit(f.size, thick(f.boards[0]!));
      if (fit) say(f.boards[0]!, fit);
    } else if (f.purpose === 'drawer-front' && f.boards.length === 2) {
      // Through the box front, into the applied front behind it.
      const length = screwLength(f.size), into = length === null ? 0 : length - thick(f.boards[0]!), room = thick(f.boards[1]!) - 1;
      if (into > room) say(f.boards[1]!, { kind: 'through', by: tidy(into - room) });
    }
  }
}

function order(mp: MakePiece, report: Report) {
  const boardStep = new Map<number, number>(), B = mp.boards;
  mp.steps.forEach((s, k) => s.boards.forEach(b => boardStep.set(b, k)));
  mp.steps.forEach((s, k) => s.items.forEach(i => {
    const f = mp.fittings[i]!;
    // What joins two boards needs both; a box's bolts go into its front before the sides come (drawer-box.ts).
    if (!joins(f) || f.purpose === 'box-front') return;
    for (const b of f.boards) {
      const placed = boardStep.get(b) ?? 0;
      if (placed > k) report({ kind: 'order', board: b, why: 'Hardware goes in when the boards it joins are in place.',
        what: 'A ' + f.kind + ' is fitted in step ' + (k + 1) + ', before ' + B[b]!.name + ' is there (step ' + (placed + 1) + ')' });
    }
  }));
  // Every joint can be made when the later of its boards goes in (make-sequence.ts decides how).
  for (const c of mp.joints) {
    if (!c.stuck) continue;
    report({ kind: 'joint', board: c.joint.edge, why: 'Every joint can be screwed or closed when its board goes in.',
      what: B[c.joint.edge]!.name + ' cannot be joined to ' + B[c.joint.face]!.name + ': its screws cannot be reached and it cannot travel onto dowels' });
  }
}

const BORE = {
  clash: { what: 'two holes run into each other', why: 'Bores keep at least ' + MIN_WALL + ' mm of board between them.' },
  meet: { what: 'holes from both faces meet inside the board', why: 'Two blind holes drilled towards each other must not meet.' },
  breakout: { what: 'a hole breaks out of the far face', why: 'A blind hole stops inside the board.' },
  edge: { what: 'a hole is drilled outside the board', why: 'A hole is drilled in the board, not past its edge.' },
} as const;

function drilling(mp: MakePiece, report: Report) {
  for (const f of mp.findings) {
    // A hole near an edge but inside the board is something to look at, not something that cannot be made.
    if (f.kind === 'edge' && f.gap >= 0) continue;
    report({ kind: 'bore', board: f.board, what: mp.boards[f.board]!.name + ': ' + BORE[f.kind].what + ' (' + f.gap + ' mm)', why: BORE[f.kind].why,
      measured: f.gap, limit: f.kind === 'clash' ? MIN_WALL : 0 });
  }
}

/** Everything that stops `mp` being built as set out; empty when it can be. */
export function verifyPiece(mp: MakePiece): BuildDefect[] {
  const out: BuildDefect[] = [], report: Report = defect => { out.push(defect); };
  for (const check of [cutSizes, counts, held, connectors, fasteners, drilling, order]) check(mp, report);
  return out;
}
