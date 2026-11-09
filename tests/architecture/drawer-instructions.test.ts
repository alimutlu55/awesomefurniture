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
import { BOTTOM_GROOVE, BOTTOM_PLAY } from '../../src/domain/make/drawer-box';
import { RUNNER_ENTRY } from '../../src/domain/hardware/hardware-registry';
import { hardwareDisplay } from '../../src/presentation/make/make-panel-tabs';

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
