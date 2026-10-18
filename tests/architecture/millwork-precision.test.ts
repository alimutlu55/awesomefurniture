import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareMillimetres, toMm } from '../../src/domain/geometry/millimetres';
import { sectionWidths, partitionPositions, sectionOrigins } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { partitionOptions } from '../../src/domain/planner/selection-spaces';
import { PANEL } from '../../src/domain/wardrobe/catalog.js';

/** Carpenter-grade widths: every bay is a whole millimetre, and the bays plus both sides and every
 * partition close exactly on the outer width, for any width, bay count and weighting. */

const WEIGHTS = [[100, 100, 100, 100, 100, 100], [137.2, 81.3, 100, 92.7, 100, 100], [1, 2, 3, 4, 5, 6], [64.267, 64.267, 64.267, 100, 100, 100]];
const isMm = (cm: number) => Math.abs(cm * 10 - Math.round(cm * 10)) < 1e-6;

test('shareMillimetres: whole parts that always add back up to the total', () => {
  assert.deepEqual(shareMillimetres(1928, [1, 1, 1]), [643, 643, 642]);
  assert.deepEqual(shareMillimetres(10, [1, 1, 1]), [4, 3, 3]);
  assert.deepEqual(shareMillimetres(0, [1, 2]), [0, 0]);
  assert.deepEqual(shareMillimetres(7, [0, 0]), [4, 3]);
  for (let total = 0; total < 3000; total += 37) for (const w of WEIGHTS) {
    const parts = shareMillimetres(total, w);
    assert.ok(parts.every(Number.isInteger));
    assert.equal(parts.reduce((a, b) => a + b, 0), total);
  }
  assert.equal(toMm(183.4), 1834);
  assert.equal(toMm(0.1 + 0.2), 3);
});

test('bays are whole millimetres and close exactly on the outer width (Σ bays + (n + 1) × panel = W)', () => {
  for (let w10 = 600; w10 <= 3000; w10 += 7) for (let n = 1; n <= 6; n++) for (const wt of WEIGHTS) {
    const w = w10 / 10, ws = sectionWidths({ w, n, wt });
    assert.equal(ws.length, n);
    assert.ok(ws.every(isMm), `W ${w}, ${n} bays: ${ws.join(', ')} are whole millimetres`);
    assert.equal(ws.reduce((a, x) => a + toMm(x), 0) + (n + 1) * toMm(PANEL), w10, `W ${w}, ${n} bays add up`);
    // Shown at 0.1 cm, the numbers a person reads add up too.
    assert.equal(ws.reduce((a, x) => a + Math.round(x * 10), 0) + (n + 1) * 18, w10);
  }
});

test('partitions and bay origins sit on the millimetre grid and tile the width without gaps', () => {
  const design = { w: 183.4, n: 4, wt: [137.2, 81.3, 100, 92.7, 100, 100] };
  const ws = sectionWidths(design), origins = sectionOrigins(design), parts = partitionPositions(design);
  assert.ok([...origins, ...parts].every(isMm));
  origins.forEach((o, k) => {
    if (k < parts.length) assert.ok(Math.abs(o + ws[k]! - parts[k]!) < 1e-9, 'bay ends at its partition');
    if (k > 0) assert.ok(Math.abs(parts[k - 1]! + PANEL - o) < 1e-9, 'partition is one board thick');
  });
  assert.ok(Math.abs(origins[ws.length - 1]! + ws[ws.length - 1]! + PANEL - design.w) < 1e-9, 'last bay ends at the right side panel');
});

test('a width off the millimetre grid (older saves) still closes exactly', () => {
  const ws = sectionWidths({ w: 200.03, n: 3, wt: [100, 100, 100] });
  assert.ok(Math.abs(ws.reduce((a, b) => a + b, 0) + 4 * PANEL - 200.03) < 1e-9);
});

test('Auto design plans bays in whole millimetres that close on the inner width', () => {
  for (const w of [90, 160, 183.4, 200, 241.7]) {
    for (const ws of partitionOptions({ w, h: 230, d: 60 } as never)) {
      assert.ok(ws.every(isMm), `W ${w}: ${ws.join('/')}`);
      assert.equal(ws.reduce((a, x) => a + toMm(x), 0) + (ws.length + 1) * 18, toMm(w));
    }
  }
});

test('carcass boards never run into each other along the depth', async () => {
  const { BACK_PANEL, fittingDepth, partitionDepth, interiorDepth, depthForFitting } = await import('../../src/domain/wardrobe/carcass');
  for (const d of [35, 45, 58.6, 60, 78]) {
    for (const board of [fittingDepth(d), partitionDepth(d)]) {
      assert.ok(Math.abs(board.z0 - BACK_PANEL) < 1e-9, 'starts on the back board face');
      assert.ok(board.z1 <= d + 1e-9 && board.z1 > board.z0);
      assert.ok(Math.abs(board.centre - ((board.z0 + board.z1) / 2 - d / 2)) < 1e-9);
      assert.ok(board.centre - board.depth / 2 >= -d / 2 + BACK_PANEL - 1e-9, 'rear face is in front of the back board');
    }
    assert.ok(Math.abs(fittingDepth(d).depth - (d - 2)) < 1e-9, 'usable fitting depth stays d - 2');
    assert.ok(Math.abs(depthForFitting(fittingDepth(d).depth) - d) < 1e-9);
    assert.ok(Math.abs(interiorDepth(d) - (d - BACK_PANEL)) < 1e-9);
  }
});

test('a fitting measures its gaps to the real neighbour, never through it', async () => {
  const { createWardrobeGeometry } = await import('../../src/domain/geometry/wardrobe-geometry.js');
  const S: any = { w: 200, h: 230, d: 60, n: 3, wt: [100, 100, 100], dividers: [], profile: { longDrop: 160 },
    secs: [[{ k: 'short', h: 102.4 }, { k: 'shelf', h: 27.8 }, { k: 'shelf', h: 27.8 }], [], []] };
  const g = createWardrobeGeometry(() => S), m = g.itemMeasurements(0, 1)!;
  assert.equal(m.gapBelow, 0, 'the shelf stands on the rail fitting below');
  assert.equal(m.lineBelow.to, 'fitting');
  assert.equal(m.gapAbove, 0, 'the next shelf sits directly on it');
  assert.ok(m.bottom > 100 && m.top > 30, 'the carcass-referenced figures still exist for placing the fitting');
  const top = g.itemMeasurements(0, 2)!;
  assert.equal(top.lineAbove.to, 'top');
  assert.ok(Math.abs(top.gapAbove - top.top) < .01, 'the top shelf of a regular bay runs to the top');
});

test('rail drop, drawer stack and an open shelf’s clear opening', async () => {
  const { createWardrobeGeometry } = await import('../../src/domain/geometry/wardrobe-geometry.js');
  const { RAIL_DROP, INTERIOR_FLOOR } = await import('../../src/domain/wardrobe/carcass');
  const S: any = { w: 200, h: 230, d: 60, n: 3, wt: [100, 100, 100], dividers: [], profile: { longDrop: 160 },
    secs: [[{ k: 'drawer', h: 22 }, { k: 'drawer', h: 22 }, { k: 'drawer', h: 22 }, { k: 'short', h: 106 }], [{ k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }], []] };
  const g = createWardrobeGeometry(() => S);
  const rail = g.railDrop(0, 3)!;
  assert.ok(Math.abs(rail.y - (INTERIOR_FLOOR + 66 + 106 - RAIL_DROP)) < .01, 'rail centre is RAIL_DROP under the fitting top');
  assert.ok(Math.abs(rail.drop - (106 - RAIL_DROP)) < .01, 'drop runs from the rail to the drawer stack it hangs over');
  assert.equal(g.railDrop(0, 0), null, 'a drawer has no rail');
  const stack = g.drawerStack(0, 1)!;
  assert.equal(stack.count, 3);
  assert.ok(Math.abs(stack.h - 66) < .01);
  assert.equal(stack.above.gap, 0, 'the rail fitting sits on the stack');
  const lower = g.netOpening(1, 0)!, upper = g.netOpening(1, 1)!;
  assert.ok(lower.h < lower.pitch && upper.h < upper.pitch, 'the clear opening is the pitch less the boards');
  assert.ok(Math.abs(lower.h - (30 - 1.8)) < .01, 'on the base board: only its own top board is deducted');
});

test('under a sloped top a free space is measured where it is tallest, and stays under the top', async () => {
  const { createWardrobeGeometry } = await import('../../src/domain/geometry/wardrobe-geometry.js');
  const { createFromTemplate } = await import('../../src/domain/wardrobe/shape/shape-templates');
  const start = createFromTemplate('sloped', { w: 200, h: 230, maxN: 6 });
  const S: any = { w: 200, h: 230, d: 60, n: start.n, wt: start.wt, shape: start.shape, dividers: [], profile: { longDrop: 160 }, secs: [[], [], [], [], [], []] };
  const g = createWardrobeGeometry(() => S);
  for (let i = 0; i < S.n; i++) {
    const space = g.sectionSpaceMeasurements(i) as { x0: number; x1: number; y0: number; y1: number; h: number; hMin: number }, tall = g.spaceTallest(i, space);
    assert.ok(tall.x >= space.x0 && tall.x <= space.x1);
    assert.ok(tall.h <= space.h + .01 && tall.h >= space.hMin - .01);
    // The ruler's top is under the top board at the x where it stands.
    assert.ok(space.y0 + tall.h <= 9.8 + g.ceilingIn(i, tall.x - .01, tall.x + .01) + .02, `bay ${i + 1}`);
  }
});

test('kitchen elevations reconcile: plinth, base carcass, worktop, splashback gap, wall unit', async () => {
  const { kitchenUnit, WORKTOP } = await import('../../src/domain/kitchen/kitchen-units');
  const { PLINTH } = await import('../../src/domain/wardrobe/catalog.js');
  const base = kitchenUnit('base'), upper = kitchenUnit('upper'), tall = kitchenUnit('tall');
  const counter = base.elevation + base.h + WORKTOP.thickness;
  assert.equal(base.h - PLINTH, 78, 'base carcass above the plinth');
  assert.equal(counter, 90, 'work surface height');
  assert.equal(upper.elevation - counter, 52, 'clear splashback gap between worktop and wall units');
  assert.ok(upper.d < base.d, 'wall units are recessed behind the base run');
  // Known: wall-unit tops (212) sit 3 cm under tall-unit tops (215); see docs/millwork-precision.md.
  assert.equal(tall.h - (upper.elevation + upper.h), 3);
});

test('a fitting resizes from its bottom edge: the top stays, the bottom stops at what is under it', async () => {
  const { createWardrobeGeometry } = await import('../../src/domain/geometry/wardrobe-geometry.js');
  const { sectionAfterEdgeResize } = await import('../../src/application/commands/item-edge-resize');
  const S: any = { w: 200, h: 230, d: 60, n: 3, wt: [100, 100, 100], dividers: [], profile: { longDrop: 160 },
    secs: [[{ k: 'drawer', h: 22 }, { k: 'shelf', h: 30, y: 40 }], [], []] };
  const g = createWardrobeGeometry(() => S), geom = g.itemGeom(0, 1)!, layout = g.resizeObstacles(0);
  assert.equal(geom.y0, 9.8 + 40); assert.equal(geom.y1, 9.8 + 70);
  // Down: the bottom stops on the drawer below (22 cm), the top stays at 70.
  const down = g.itemEdgeSize(geom, 'bottom', -100, layout, 1, 25, 15, 65);
  assert.equal(down.y, 22); assert.equal(down.h, 48);
  assert.ok(Math.abs(down.y + down.h - 70) < 1e-9, 'the top edge did not move');
  // Up: the smallest height (15) keeps the top where it is.
  const up = g.itemEdgeSize(geom, 'bottom', 100, layout, 1, 25, 15, 65);
  assert.equal(up.h, 15); assert.equal(up.y, 55);
  const session = { edge: 'bottom', original: S.secs[0], index: 1, section: 0, g: { bw: geom.bw }, layout } as never;
  const sec = sectionAfterEdgeResize(session, { h: 30, y: 28 })!;
  assert.deepEqual([sec[1]!.y, sec[1]!.h, sec[0]!.y], [28, 30, 0], 'the bottom moved, the others stand where they were');
});
