import { test } from 'node:test';
import assert from 'node:assert/strict';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import type { Dimensions, Item } from '../../src/domain/drawings/drawing';
import type { DrawingPiece } from '../../src/domain/drawings/room-pieces';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { FURNITURE } from '../../src/domain/furniture/furniture';
import { printableDocument } from '../../src/presentation/drawings/drawings-viewer';

/** Technical drawings: what a carpenter builds and fits from, every figure in whole millimetres. */

/** One 300 cm wall, 10 cm thick, with a window; its room face runs along z = 5. */
const room = () => ({ template: 'custom' as const, corners: [{ id: 'c1', x: 0, z: 0 }, { id: 'c2', x: 300, z: 0 }],
  walls: [{ id: 'w1', a: 'c1', b: 'c2', thickness: 10, height: 260 }],
  openings: [{ id: 'o1', wall: 'w1', kind: 'window' as const, offset: 220, width: 100, height: 120, sill: 100 }] });
const against = (id: number, unit: Parameters<typeof createKitchenDesign>[0], preset: string, x: number, y = 0): DrawingPiece => {
  const design = createKitchenDesign(unit, preset);
  return { id, name: preset, x, y, z: 5 + design.d / 2, angle: 0, design };
};
const kitchen = () => [against(1, 'base', 'drawers', 100), against(2, 'upper', 'upper', 100, 142), against(3, 'tall', 'fridge', 30)];
const dims = (items: readonly Item[]) => items.filter((i): i is Dimensions => i.kind === 'dims');

test('a plan, then an elevation of each wall with furniture, then each piece standing free', () => {
  const free = { id: 9, name: 'Wardrobe 1', x: 150, y: 0, z: 200, angle: 0, design: createInitialDesign() };
  assert.deepEqual(technicalDrawings({ studio: room(), pieces: [...kitchen(), free] }).map(s => s.title), ['Plan', 'Elevation A', 'Front elevation W1']);
  assert.deepEqual(technicalDrawings({ pieces: [free] }).map(s => s.title), ['Plan', 'Front elevation W1'], 'no room: the piece on its own');
});

test('marks run along the wall, left to right, each kind of furniture counting on its own', () => {
  const [plan] = technicalDrawings({ studio: room(), pieces: kitchen() });
  assert.deepEqual(plan!.pieces.map(p => [p.mark, p.name, p.size, p.where]), [
    ['K1', 'Tall cabinet', '600 × 2150 × 580', 'Wall A'],
    ['K2', 'Base cabinet', '600 × 860 × 580', 'Wall A'],
    ['K3', 'Wall cabinet', '600 × 700 × 350', 'Wall A, underside 1420'],
  ]);
  assert.equal(new Set(FURNITURE.map(m => m.mark)).size, FURNITURE.length, 'each kind of furniture has its own letter');
});

test('the plan dimensions every piece and gap to the wall ends, the window, the wall, and the depth', () => {
  const [plan] = technicalDrawings({ studio: room(), pieces: kitchen() });
  const strings = dims(plan!.items).map(d => d.stops);
  assert.deepEqual(strings, [[0, 600, 700, 1300, 3000], [0, 700, 1300, 3000], [0, 1700, 2700, 3000], [0, 3000], [0, 580, 600]],
    'floor units with the gap between them; the wall unit; the window; the wall; carcass depth and worktop overhang');
  const notes = plan!.items.filter(i => i.kind === 'note').map(i => i.kind === 'note' && i.lines.join(' '));
  assert.deepEqual(notes, ['Window 1000 × 1200, sill 1000']);
});

test('the elevation stacks every height from the floor and gives the window its sill and head', () => {
  const [, elevation] = technicalDrawings({ studio: room(), pieces: kitchen() });
  const [floor, wall, above, openings, heights, window] = dims(elevation!.items).map(d => d.stops);
  assert.deepEqual(floor, [0, 600, 700, 1300, 3000]);
  assert.deepEqual(wall, [0, 3000]);
  assert.deepEqual(above, [0, 700, 1300, 3000], 'the wall unit');
  assert.deepEqual(openings, [0, 1700, 2700, 3000]);
  assert.deepEqual(heights, [0, 80, 860, 900, 1420, 2120, 2150, 2600], 'plinth, carcass, worktop, wall unit underside and top, tall unit, ceiling');
  assert.deepEqual(window, [0, 1000, 2200, 2600]);
});

test('fronts show how they open: door triangles point at the hinges, a fall-down door at its bottom', () => {
  const [, elevation] = technicalDrawings({ studio: room(), pieces: [against(1, 'base', 'dishwasher', 100), against(2, 'tall', 'fridge', 30)] });
  const swings = elevation!.items.filter(i => i.kind === 'line' && i.stroke === 'swing').map(i => i.kind === 'line' ? i.points.map(p => [p.x, p.y]) : []);
  // The fridge housing (0–600): a cupboard over the fridge door over the freezer door, each hinged on the left.
  const tall = swings.filter(([a]) => a![0]! < 650);
  assert.equal(tall.length, 3, 'cupboard, fridge and freezer');
  for (const [a, apex, b] of tall) assert.ok(apex![0]! < a![0]! && apex![0]! < b![0]!, 'apex at the hinges on the left: ' + JSON.stringify([a, apex, b]));
  // The dishwasher (700–1300) falls down: its apex is at the bottom.
  const [dish] = swings.filter(([a]) => a![0]! > 650);
  assert.ok(dish![1]![1]! < dish![0]![1]! && dish![1]![1]! < dish![2]![1]!, 'apex at the bottom');
  const names = elevation!.items.filter(i => i.kind === 'note' && i.small).map(i => i.kind === 'note' && i.lines[0]);
  assert.deepEqual(names.sort(), ['Dishwasher', 'Fridge', 'Fridge']);
});

test('the plan marks tall units, appliances under the worktop and drawers', () => {
  const [plan] = technicalDrawings({ studio: room(), pieces: [against(1, 'tall', 'fridge', 30), against(2, 'base', 'dishwasher', 90), against(3, 'base', 'drawers', 150)] });
  const lines = plan!.items.filter(i => i.kind === 'line');
  const cross = (x0: number, x1: number, stroke: string) => lines.filter(i => i.kind === 'line' && i.stroke === stroke && i.points.length === 2
    && i.points.every(p => p.x >= x0 - 1 && p.x <= x1 + 1) && Math.abs(i.points[0]!.x - i.points[1]!.x) > 100).length;
  assert.equal(cross(0, 600, 'thin'), 2, 'a cross over the tall unit');
  assert.equal(cross(600, 1200, 'hidden'), 2, 'a dashed cross over the dishwasher unit');
  assert.deepEqual(plan!.items.filter(i => i.kind === 'arrow').map(i => i.kind === 'arrow' && i.at.x), [1500], 'an arrow out of the drawer unit');
});

test('what to check: pieces in one place, in front of a window, past the wall, taller than it', () => {
  const clash = [against(1, 'base', 'drawers', 100), against(2, 'base', 'drawers', 130), against(3, 'upper', 'upper', 210, 142), against(4, 'base', 'drawers', 290)];
  const [plan, elevation] = technicalDrawings({ studio: room(), pieces: clash });
  assert.deepEqual(plan!.checks, ['K1 and K2 overlap', 'K3 stands in front of the window on wall A', 'K4 runs 200 past the end of wall A']);
  assert.deepEqual(elevation!.checks, plan!.checks, 'the wall\'s elevation repeats the checks about its pieces');
  assert.deepEqual(technicalDrawings({ studio: room(), pieces: kitchen() })[0]!.checks, [], 'a good kitchen has nothing to check');
});

test('a run turning a corner is seen from its end on the next wall, and a piece standing free is set out from the walls', () => {
  const corner = { template: 'custom' as const, openings: [], corners: [{ id: 'c1', x: 0, z: 300 }, { id: 'c2', x: 0, z: 0 }, { id: 'c3', x: 300, z: 0 }],
    walls: [{ id: 'w1', a: 'c1', b: 'c2', thickness: 10, height: 260 }, { id: 'w2', a: 'c2', b: 'c3', thickness: 10, height: 260 }] };
  const back = createKitchenDesign('base', 'drawers'), side = createKitchenDesign('base', 'drawers'), island = createKitchenDesign('base', 'drawers');
  const pieces = [{ id: 1, name: 'a', x: 5 + 30, y: 0, z: 5 + 29, angle: 0, design: back }, { id: 2, name: 'b', x: 5 + 29, y: 0, z: 5 + 58 + 30, angle: 90, design: side },
    { id: 3, name: 'c', x: 150, y: 0, z: 200, angle: 0, design: island }];
  const sheets = technicalDrawings({ studio: corner, pieces });
  assert.deepEqual(sheets.map(s => s.title), ['Plan', 'Elevation A', 'Elevation B', 'Front elevation K3']);
  // On wall A (left), K2 stands in front; K1 on the other wall comes into the corner and is seen from its side.
  const tags = sheets[1]!.items.filter(i => i.kind === 'tag').map(i => i.kind === 'tag' && i.text);
  assert.deepEqual(tags.sort(), ['K1', 'K2']);
  const floor = dims(sheets[1]!.items)[0]!.stops;
  assert.ok(floor.includes(2370) && floor.includes(3000 - 50 - 580 - 600), 'the return and the unit on the floor string: ' + floor);
  // The island: its distance to the wall behind it and to the nearer wall beside it.
  const free = dims(sheets[0]!.items).filter(d => d.stops.length === 2 && ![600, 580, 2950].includes(d.stops[1]!)).map(d => d.stops[1]);
  assert.deepEqual(free.sort((a, b) => a! - b!), [1150, 1660]);
});

test('every dimension string is whole millimetres, in order, and adds up to its total', () => {
  for (const sheet of technicalDrawings({ studio: room(), pieces: kitchen() })) {
    for (const d of dims(sheet.items)) {
      assert.ok(d.stops.every(Number.isInteger), sheet.title + ': whole millimetres ' + d.stops);
      assert.ok(d.stops.every((s, k) => k === 0 || s > d.stops[k - 1]!), sheet.title + ': ascending ' + d.stops);
      const parts = d.stops.slice(1).map((s, k) => s - d.stops[k]!);
      assert.equal(parts.reduce((a, b) => a + b, 0), d.stops[d.stops.length - 1]! - d.stops[0]!);
    }
  }
});

test('the printed set is one A3 landscape page per sheet', () => {
  const sheets = technicalDrawings({ studio: room(), pieces: kitchen() });
  const html = printableDocument(sheets, { project: 'Kitchen <test>', date: '19.10.2026', total: sheets.length });
  assert.match(html, /@page\{size:420mm 297mm;margin:0\}/);
  assert.equal(html.match(/<svg /g)?.length, sheets.length);
  assert.ok(!html.includes('<test>'), 'text is escaped');
});
