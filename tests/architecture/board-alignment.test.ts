import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardAlignTargets, type BayView } from '../../src/domain/geometry/board-alignment';
import { resolveAlignment } from '../../src/domain/geometry/alignment';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createDividerAlign } from '../../src/application/commands/divider-align';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { PANEL as T } from '../../src/domain/wardrobe/catalog.js';

/** Boards (shelf boards and dividers) line up through the shared alignment rule while they are dragged. */

const shelf = (index: number, y: number, x0 = 0, x1 = 100) => ({ index, orientation: 'horizontal' as const, rect: { x0, x1, y0: y - T / 2, y1: y + T / 2 } });
const upright = (index: number, x: number, y0: number, y1: number) => ({ index, orientation: 'vertical' as const, rect: { x0: x - T / 2, x1: x + T / 2, y0, y1 } });
const bay = (o: Partial<BayView> = {}): BayView => ({ width: 100, top: 200, items: [], boards: [], ...o });
const labels = (ts: ReturnType<typeof boardAlignTargets>) => ts.map(t => t.label + '@' + Math.round(t.v * 100) / 100);

test('a shelf board lines up with the shelves in the next bay, a fitting beside it, and the middle of its space', () => {
  const bays = [bay({ boards: [shelf(0, 90)] }), bay({ boards: [shelf(1, 120)], items: [{ x0: 0, x1: 100, y0: 0, y1: 60 }] })];
  assert.deepEqual(labels(boardAlignTargets(bays, 0, 0, T)).sort(),
    ['Aligned@59.1', 'Centred@100', 'Level with shelf@120'].sort());
  const pick = (raw: number) => resolveAlignment(raw, boardAlignTargets(bays, 0, 0, T), { tolerance: 2 })?.label ?? null;
  assert.equal(pick(118.6), 'Level with shelf');
  assert.equal(pick(58), 'Aligned', "its top level with the drawers' top next door");
  assert.equal(pick(80), null, 'no guide when nothing is near');
});

test('what rests on a shelf or hangs from it moves with it, so it does not bound the space the shelf divides', () => {
  const resting = { x0: 0, x1: 100, y0: 90 + T / 2, y1: 130 }, below = { x0: 0, x1: 100, y0: 0, y1: 40 };
  const centred = boardAlignTargets([bay({ boards: [shelf(0, 90)], items: [resting, below] })], 0, 0, T).find(t => t.label === 'Centred')!;
  assert.equal(centred.v, 120, 'between the fitting below (40) and the top (200)');
  // A divider standing on the shelf does not bound it either: only boards running the same way do.
  const withUpright = boardAlignTargets([bay({ boards: [shelf(0, 90), upright(1, 50, 90 + T / 2, 200)] })], 0, 0, T);
  assert.equal(withUpright.find(t => t.label === 'Centred')!.v, 100);
});

test('a divider lines up with a divider across a shelf, a fitting side above or below it, and the middle of its space', () => {
  const b = bay({ boards: [upright(0, 40, 0, 100), shelf(1, 100 + T / 2), upright(2, 55, 100 + T, 200)],
    items: [{ x0: 70, x1: 100, y0: 0, y1: 30 }, { x0: 10, x1: 30, y0: 150, y1: 170 }] });
  const found = labels(boardAlignTargets([b], 0, 0, T)).sort();
  assert.deepEqual(found, ['Aligned with divider@55', 'Aligned@30.9', 'Aligned@9.1', 'Centred@35'].sort(),
    'the fitting beside it (overlapping its height) bounds the middle, the one above lines up with its faces');
  assert.deepEqual(boardAlignTargets([b], 0, 9, T), [], 'no such board');
});

function twoBays() {
  const state = { ...createEditorState(), w: 200, h: 240, n: 2, sel: 0 };
  state.secs = [[], [], [], [], [], []];
  const ws = createWardrobeGeometry(() => state).widths();
  state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: ws[0]!, y: 100 }, { i: 1, orientation: 'horizontal', x0: 0, x1: ws[1]!, y: 120 }] as typeof state.dividers;
  return { state, commands: createDesignCommands(() => state), rules: createWardrobeGeometry(() => state), ws };
}

test('dragged near the shelf next door, a shelf board lands exactly level with it and shows one guide across both', () => {
  const { state, commands, rules, ws } = twoBays();
  const snap = commands.alignDividerTo(0, 118.6, { tolerance: 2 });
  assert.equal(state.dividers[0]!.y, 120, 'exactly level, to the millimetre');
  assert.equal(snap.line?.label, 'Level with shelf');
  assert.deepEqual(snap.guide && { ...snap.guide, span: snap.guide.span.map(v => Math.round(v * 100) / 100) },
    { orient: 'h', pos: rules.interiorFloor() + 120, span: [T, Math.round((T + ws[0]! + T + ws[1]!) * 100) / 100], label: 'Level with shelf', kind: 'board' });
  // Held while the pointer stays near, let go beyond.
  const held = commands.alignDividerTo(0, 117, { tolerance: 2, lock: snap.line });
  assert.equal(state.dividers[0]!.y, 120); assert.equal(held.line?.label, 'Level with shelf');
  const free = commands.alignDividerTo(0, 110, { tolerance: 2, lock: snap.line });
  assert.equal(state.dividers[0]!.y, 110); assert.equal(free.line, null); assert.equal(free.guide, null);
  commands.alignDividerTo(0, 119, { tolerance: 2, free: true });
  assert.equal(state.dividers[0]!.y, 119, 'Shift moves freely');
});

test('a line the board cannot reach exactly is never shown: the next one is tried, else it moves as a drag does', () => {
  const { state, rules } = twoBays();
  state.dividers.push({ i: 1, orientation: 'horizontal', x0: 0, x1: rules.widths()[1]!, y: 117.5 } as typeof state.dividers[0]);
  // Something stands in the way above 118: the board stops there, as the real move stops against a solid.
  const blocked = (index: number, v: number) => { state.dividers[index]!.y = Math.min(v, 118); return true; };
  const { alignDividerTo } = createDividerAlign({ getDesign: () => state, rules, moveDividerTo: blocked });
  const next = alignDividerTo(0, 119.4, { tolerance: 2 });
  assert.equal(state.dividers[0]!.y, 117.5, 'the nearer line (120) is out of reach; the next one (117.5) is not');
  assert.equal(next.guide?.pos, rules.interiorFloor() + 117.5);
  state.dividers.pop();
  const none = alignDividerTo(0, 119.4, { tolerance: 2 });
  assert.equal(none.guide, null, 'no guide for a line it did not reach');
  assert.equal(state.dividers[0]!.y, 118, 'where a drag would leave it');
});
