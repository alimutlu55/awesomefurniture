import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { makePiece } from '../../src/domain/make/make-parts';
import { pulloutSpans } from '../../src/domain/make/make-hardware';
import { HINGE_PULLOUT_CLEAR, hingeClashes, hingeStations, hingeStationsClear } from '../../src/domain/wardrobe/hinges';
import { hingeDrawer } from '../../src/domain/drawings/manufacturing-rules/hinge-drawer';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';
import { alone, goldenWardrobes } from './rule-fixtures';
import { BOTTOM_GROOVE, BOTTOM_PLAY, GROOVE_WIDTH } from '../../src/domain/make/drawer-box';
import { HARDWARE, RUNNER_ENTRY } from '../../src/domain/hardware/hardware-registry';
import { TOOLS } from '../../src/domain/hardware/tools';
import { drawerHand, stepNotes } from '../../src/domain/make/make-instructions';
import { hardwareDisplay } from '../../src/presentation/make/make-panel-tabs';
import { stepPages, wrap } from '../../src/presentation/make/make-steps-pdf';
import { marksToPdf } from '../../src/presentation/drawings/pdf-writer';
import { blows } from '../../src/presentation/make/make-play-3d';
import { assemblyTimeline } from '../../src/domain/make/make-timeline';

// Drawers at the bottom of the left bay, behind hinged doors: the reference flat-pack manual moves drawers a hole up for
// hinged doors; a made wardrobe moves the hinges.
const wardrobe: EditorDesign = { ...createInitialDesign(), w: 100, h: 220, d: 60, n: 2, wt: [1, 1], doors: 'hinged',
  secs: [[{ k: 'drawer', h: 20 }, { k: 'drawer', h: 20 }, { k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }], [{ k: 'long', h: 160 }]] };
const made = (design: EditorDesign) => makePiece(alone(design), 1)!;

test('hinges move out of what slides past them, keeping their number, inset and spread', () => {
  assert.deepEqual(hingeStationsClear(211, []), hingeStations(211));
  const moved = hingeStationsClear(211, [[0, 40]]);
  assert.equal(moved.length, hingeStations(211).length);
  assert.ok(moved[0]! >= 40 + HINGE_PULLOUT_CLEAR - 1e-9, `lowest hinge ${moved[0]} above the drawers`);
  assert.equal(moved.at(-1), hingeStations(211).at(-1));
  assert.deepEqual(hingeClashes(moved, [[0, 40]]), []);
  // No room to spread them: they stay, and the clash is reported.
  assert.deepEqual(hingeStationsClear(140, [[0, 110]]), hingeStations(140));
});

test('no hinge plate sits beside a drawer behind its door', () => {
  const mp = made(wardrobe);
  mp.fittings.forEach(f => {
    if (f.kind !== 'hinge' || f.boards.length < 2) return;
    const door = mp.boards[f.boards[0]!]!, post = mp.boards[f.boards[1]!]!, side = f.at[0] < (door.x0 + door.x1) / 2 ? 'left' : 'right';
    assert.deepEqual(hingeClashes([f.at[1] - door.y0], pulloutSpans(mp.boards, post, side, door)), [], `hinge at ${f.at[1]}`);
  });
  for (const [name, design] of goldenWardrobes().filter(([n]) => n.startsWith('regular'))) {
    const input = alone({ ...design, doors: 'hinged' });
    assert.deepEqual(hingeDrawer(input, placePieces(input)), [], name);
  }
});

test('a door too short to move its hinges past the drawers is a critical finding', () => {
  const [, design] = goldenWardrobes().find(([n]) => n === 'stepped-default')!;
  const input = alone({ ...design, doors: 'hinged' }), found = hingeDrawer(input, placePieces(input));
  assert.ok(found.length > 0);
  assert.ok(found.every(f => f.severity === 'critical' && f.fix === 'Move the drawer up or down'));
});

test('the bottom slides into its grooves with an equal gap each end; the grooves are full depth', () => {
  const mp = made(wardrobe);
  for (const d of mp.drawers ?? []) {
    const bottom = mp.boards[d.bottom]!, [l, r] = d.sides.map(k => mp.boards[k]!) as [typeof bottom, typeof bottom];
    const gapLeft = Math.round((bottom.x0 - (l.x1 - BOTTOM_GROOVE.depth)) * 100) / 100, gapRight = Math.round((r.x0 + BOTTOM_GROOVE.depth - bottom.x1) * 100) / 100;
    assert.equal(gapLeft, BOTTOM_PLAY); assert.equal(gapRight, BOTTOM_PLAY);
    for (const k of [d.front, ...d.sides, d.back]) {
      const g = mp.grooves.find(q => q.board === k)!, depth = Math.min(...[0, 2].map(a => g.hi[a]! - g.lo[a]!));
      assert.equal(Math.round(depth * 100) / 100, BOTTOM_GROOVE.depth, `${mp.boards[k]!.name} groove depth`);
    }
  }
});

test('runner holes: Ø2.5 pilots for the front screws, a Ø5 hole for the rear peg, as the instructions say', () => {
  const mp = made(wardrobe), runner = mp.fittings.findIndex(f => f.runner);
  const fixed = mp.fittings[runner]!.runner!.fixed[0]!;
  const screws = mp.holes.filter(h => h.board === fixed && h.kind === 'runner' && mp.fittings[h.of!]?.purpose === 'runner-mount' && Math.abs(h.at[1] - mp.fittings[runner]!.at[1]) < .01);
  const peg = mp.holes.filter(h => h.board === fixed && h.kind === 'runner' && h.of === runner);
  assert.deepEqual(screws.map(h => h.d), [2.5, 2.5]);
  assert.deepEqual(peg.map(h => h.d), [5]);
  assert.match(RUNNER_ENTRY.assembly.instructions.drill!, /Ø2\.5 mm pilot holes.*Ø5 mm hole/);
});

test('runners are called what they are: no full extension or soft close they do not have', () => {
  const shown = hardwareDisplay({ kind: 'runner', size: '450' });
  assert.doesNotMatch(shown.name + shown.size, /soft|full/i);
  assert.match(shown.name, /left and right/);
});

test('every piece of hardware says which tools it goes in with and how, as a manual draws it', () => {
  for (const h of HARDWARE) {
    assert.ok(h.assembly.tools?.length, `${h.key}: tools`);
    assert.ok(h.assembly.tools!.every(t => t in TOOLS), `${h.key}: known tools`);
    assert.ok(h.assembly.cue, `${h.key}: cue`);
  }
});

test('a drawer takes what the flat-pack drawer manual counts, step by step, once per drawer', () => {
  const mp = made(wardrobe), k = (stage: string) => mp.steps.findIndex(s => s.stage === stage);
  const kit = (stage: string) => { const kits = stepNotes(mp, k(stage)).kits; assert.equal(kits.length, 1, stage); assert.equal(kits[0]!.drawers, 2); return Object.fromEntries(kits[0]!.each.map(c => [`${c.kind} ${c.size}`, c.qty])); };
  assert.deepEqual(kit('drawer-boxes'), { 'bolt 34': 4 });
  assert.deepEqual(kit('drawer-sides'), { 'cam 15 mm': 4, 'dowel 8 × 35': 2 });
  assert.deepEqual(kit('drawer-back'), { 'dowel 8 × 30 expanding': 4 });
  assert.deepEqual(kit('drawer-runners'), { 'runner 550': 1, 'screw 4 × 12': 4 });
  assert.deepEqual(kit('drawers'), { 'drawerLock plate': 2 });
  assert.deepEqual(kit('drawer-lock'), { 'drawerLock lever': 2 });
  assert.deepEqual(stepNotes(mp, k('drawer-sides')).tools, ['drill', 'flat', 'hand'], 'wooden dowels go in by hand');
  assert.deepEqual(stepNotes(mp, k('drawer-lock')).tools, ['hand']);
  assert.ok(stepNotes(mp, k('drawer-boxes')).avoid.some(a => /soft mat/.test(a)));
});

test('the runners step says where each runner goes; box sides are named left and right', () => {
  const mp = made(wardrobe), k = mp.steps.findIndex(s => s.stage === 'drawer-runners'), places = stepNotes(mp, k).runners;
  assert.equal(places.length, 4, 'two drawers, a runner on each side');
  for (const p of places) { assert.deepEqual(p.screws, [37, 69]); assert.ok(p.peg > p.screws[1]!); }
  const hands = mp.parts.map(p => drawerHand(mp, p)).filter(h => h);
  assert.ok(hands.includes('left') && hands.includes('right'));
  assert.equal(hardwareDisplay({ kind: 'dowel', size: '8 × 30 expanding' }).name, 'Expanding dowel');
  assert.equal(hardwareDisplay({ kind: 'drawerLock', size: 'lever' }).name, 'Locking lever');
});

test('the saved drawings print every step with its drawing, instruction, tools, drawer kit and what not to do', () => {
  const mp = made(wardrobe), pages = stepPages(mp, { x: 0, y: 0, w: 400, h: 260 });
  assert.equal(pages.length, Math.ceil(mp.steps.length / 2));
  const text = pages.flatMap(p => p.marks).flatMap(m => m.kind === 'text' ? [m.text] : []), all = text.join(' ');
  for (const s of mp.steps) assert.ok(text.includes(String(s.n)), `step ${s.n} numbered`);
  assert.match(all, /Tools: .*Flat screwdriver/);
  assert.match(all, /Each of 2 drawers: Cam bolt/);
  assert.match(all, /× Do not build a drawer on a hard floor/);
  assert.match(all, /holes 107 mm up/);
  assert.deepEqual(wrap('one two three four five', 12, 2.4), ['one two', 'three four', 'five'], 'at most 10 letters a line');
});

test('step pictures go on their page as JPEGs, the close-up framed with each fastener\'s way in', () => {
  const mp = made(wardrobe), jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pictures = mp.steps.map(() => ({ whole: { jpeg, width: 1500, height: 1000 }, detail: { jpeg, width: 900, height: 900, ways: [{ from: [.2, .2] as const, to: [.5, .5] as const }] } }));
  const pages = stepPages(mp, { x: 0, y: 0, w: 400, h: 260 }, pictures);
  assert.ok(pages.every(p => p.images.length >= 2));
  const pdf = marksToPdf(pages.map(p => p.marks), { w: 420, h: 297 }, 'Steps', pages.map(p => p.images));
  const text = new TextDecoder('latin1').decode(pdf);
  assert.match(text, /\/Subtype \/Image \/Width 1500 \/Height 1000 .*\/Filter \/DCTDecode/);
  assert.match(text, /\/XObject << \/Im0 \d+ 0 R/);
  // The cross-reference offsets count bytes, the pictures' binary included.
  const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
  assert.equal(text.slice(xref, xref + 4), 'xref');
});

test('a drawer back is hooked on and swung shut in its own turn, slow enough to follow, then hammered', () => {
  const mp = made(wardrobe), tl = assemblyTimeline(mp), k = mp.steps.findIndex(s => s.stage === 'drawer-back'), s = tl.steps[k]!;
  const backs = mp.drawers!.map(d => d.back), span = s.place[1] - s.place[0];
  for (const b of backs) assert.ok(tl.boardWindow[b]! * span >= 4, 'each back has at least 4 s');
  assert.deepEqual(backs.map(b => tl.boardStart[b]).sort(), [...new Set(backs.map(b => tl.boardStart[b]))].sort(), 'one after another');
  // The expanding dowels go in a step at each hammer blow; the hammer lands as each step is taken.
  const steps = [0, .3, .6, .95].map(p => blows(p).into);
  assert.ok(steps.every((v, i) => i === 0 || v >= steps[i - 1]!));
  assert.equal(blows(1).into, 1); assert.equal(blows(.999).off < 2, true);
  assert.ok(HARDWARE.find(h => h.key === 'dowel')!.assembly.tools!.includes('hammer'));
});

test('the bottom\'s groove is 6.5 mm for the 6 mm bottom; the runner hook goes up into the back\'s lower edge', () => {
  const mp = made(wardrobe);
  for (const d of mp.drawers ?? []) {
    const bottom = mp.boards[d.bottom]!, back = mp.boards[d.back]!;
    for (const k of [d.front, ...d.sides, d.back]) {
      const g = mp.grooves.find(q => q.board === k)!;
      assert.equal(Math.round((g.hi[1] - g.lo[1]) * 100) / 100, GROOVE_WIDTH);
      assert.equal(Math.round((g.lo[1] - bottom.y0) * 100) / 100, 0, 'the bottom rests on the groove\'s lower side');
    }
    const hooks = mp.holes.filter(h => h.board === d.back && h.kind === 'runner');
    assert.equal(hooks.length, 2);
    for (const h of hooks) {
      assert.equal(h.axis, 1); assert.equal(h.sign, 1, 'drilled up from below');
      assert.equal(h.at[1], back.y0, 'in the lower edge');
      assert.ok(h.at[2] > back.z0 && h.at[2] < back.z1, 'within the back\'s thickness');
    }
  }
  assert.deepEqual(mp.findings.filter(f => mp.drawers!.some(d => d.back === f.board)), [], 'no drilling finding on a back');
});
