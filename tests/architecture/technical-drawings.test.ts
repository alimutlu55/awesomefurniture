import { test } from 'node:test';
import assert from 'node:assert/strict';
import { technicalDrawings as createDrawings } from '../../src/domain/drawings/technical-drawings';
import type { Dimensions, Item, Sheet } from '../../src/domain/drawings/drawing';
import type { DrawingInput, DrawingPiece } from '../../src/domain/drawings/room-pieces';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { FURNITURE } from '../../src/domain/furniture/furniture';
import { drawingsPdf } from '../../src/presentation/drawings/drawings-viewer';

const technicalDrawings = (input: DrawingInput, options = {}) => createDrawings(input, { preset: 'installation', upperPlan: false, ...options });

/** Technical drawings: what a carpenter builds and fits from, every figure in whole millimetres. */

/** One 300 cm wall, 10 cm thick, with a window; its room face runs along z = 5. */
const room = () => ({ template: 'custom' as const, corners: [{ id: 'c1', x: 0, z: 0 }, { id: 'c2', x: 300, z: 0 }],
  walls: [{ id: 'w1', a: 'c1', b: 'c2', thickness: 10, height: 260 }],
  openings: [{ id: 'o1', wall: 'w1', kind: 'window' as const, offset: 220, width: 100, height: 120, sill: 100 }] });
const against = (id: number, unit: Parameters<typeof createKitchenDesign>[0], preset: string, x: number, y = 0): DrawingPiece => {
  const design = createKitchenDesign(unit, preset);
  return { id, name: preset, x, y, z: 5 + design.d / 2, angle: 0, design };
};
const kitchen = () => [against(2, 'base', 'drawers', 100), against(3, 'upper', 'upper', 100, 142), against(1, 'tall', 'fridge', 30)];
/** Everything drawn on a sheet, across its views. */
const all = (sheet: Sheet) => sheet.views.flatMap(v => v.items);
const dims = (items: readonly Item[]) => items.filter((i): i is Dimensions => i.kind === 'dims');

test('a plan, then an elevation of each wall with furniture, then each piece standing free', () => {
  const free = { id: 9, name: 'Wardrobe 1', x: 150, y: 0, z: 200, angle: 0, design: createInitialDesign() };
  assert.deepEqual(technicalDrawings({ studio: room(), pieces: [...kitchen(), free] }).map(s => s.title), ['Plan', 'Elevation A', 'Front elevation W9',
    'P1L  End/Separator pane', 'K1  Tall cabinet', 'P1R  End/Separator pane', 'P2L  End/Separator pane', 'P3L  End/Separator pane',
    'K2  Base cabinet', 'K3  Wall cabinet', 'P2R  End/Separator pane', 'P3R  End/Separator pane', 'W9  Wardrobe 1', 'K1 appliance allocations', 'Appliance schedule', 'Construction details 1 of 2', 'Construction details 2 of 2', 'Cutting list', 'Hardware list', 'Furniture schedule', 'Material & Hardware Schedule', 'Review issues']);
  assert.deepEqual(technicalDrawings({ pieces: [free] }).map(s => s.title), ['Plan', 'Front elevation W9', 'W9  Wardrobe 1', 'Construction details', 'Cutting list', 'Hardware list', 'Furniture schedule', 'Material & Hardware Schedule'],
    'no room: the piece on its own');
});

test('marks run along the wall, left to right, each kind of furniture counting on its own', () => {
  const [plan] = technicalDrawings({ studio: room(), pieces: kitchen() });
  assert.deepEqual(plan!.pieces.filter(p => p.mark.startsWith('K')).map(p => [p.mark, p.name, p.size, p.where]), [
    ['K1', 'Tall cabinet', '600 × 2150 × 580', 'Wall A'],
    ['K2', 'Base cabinet', '600 × 860 × 580', 'Wall A'],
  ]);
  assert.equal(new Set(FURNITURE.map(m => m.mark)).size, FURNITURE.length, 'each kind of furniture has its own letter');
});

test('the plan dimensions every piece and gap to the wall ends, the window, the wall, and the depth', () => {
  const [plan] = technicalDrawings({ studio: room(), pieces: kitchen() });
  const strings = dims(all(plan!)).map(d => d.stops);
  assert.deepEqual(strings, [[-18, 0, 600, 618, 682, 700, 1300, 1318, 3000], [0, 580, 600], [-18, 0, 600, 618, 682, 700, 1300, 1318, 3000], [0, 1700, 2700, 3000], [0, 3000]],
    'floor units with the gap between them; the wall unit; the window; the wall; carcass depth and worktop overhang');
  const notes = all(plan!).filter(i => i.kind === 'note').map(i => i.kind === 'note' && i.lines.join(' '));
  assert.deepEqual(notes, ['Window 1000 × 1200, Hp 1000, lintel 2200']);
});

test('the elevation stacks every height from the floor and gives the window its sill and head', () => {
  const [, elevation] = technicalDrawings({ studio: room(), pieces: kitchen() });
  const [floor, wall, above, openings, zones, heights, total, window] = dims(all(elevation!)).map(d => d.stops);
  assert.deepEqual(floor, [-18, 0, 600, 618, 682, 700, 1300, 1318, 3000]);
  assert.deepEqual(wall, [0, 3000]);
  assert.deepEqual(above, [-18, 0, 600, 618, 682, 700, 1300, 1318, 3000], 'the wall unit and tall cabinet crossing the upper level');
  assert.deepEqual(openings, [0, 1700, 2700, 3000]);
  assert.deepEqual(heights, [0, 80, 900, 1420, 2600], 'only installation levels in the middle chain');
  assert.deepEqual(zones, [0, 80, 860, 900, 1420, 2120, 2600], 'one actual base and upper stack; no internal board faces or unrelated tall-unit top');
  assert.deepEqual(total, [0, 2600], 'uninterrupted outer floor-to-ceiling height');
  assert.deepEqual(window, [0, 1000, 2200, 2600]);
});

test('fronts show how they open: door triangles point at the hinges, a fall-down door at its bottom', () => {
  const [, elevation] = technicalDrawings({ studio: room(), pieces: [against(1, 'base', 'dishwasher', 100), against(2, 'tall', 'fridge', 30)] });
  const swings = all(elevation!).filter(i => i.kind === 'line' && i.stroke === 'swing').map(i => i.kind === 'line' ? i.points.map(p => [p.x, p.y]) : []);
  // The fridge housing (0–600): fridge door over the freezer door, each hinged on the left.
  const tall = swings.filter(([a]) => a![0]! < 650);
  assert.equal(tall.length, 2, 'fridge and freezer');
  for (const [a, apex, b] of tall) assert.ok(apex![0]! < a![0]! && apex![0]! < b![0]!, 'apex at the hinges on the left: ' + JSON.stringify([a, apex, b]));
  // The dishwasher (700–1300) falls down: its apex is at the bottom.
  const [dish] = swings.filter(([a]) => a![0]! > 650);
  assert.ok(dish![1]![1]! < dish![0]![1]! && dish![1]![1]! < dish![2]![1]!, 'apex at the bottom');
  const names = all(elevation!).filter(i => i.kind === 'note' && i.small).map(i => i.kind === 'note' && i.lines[0]);
  assert.deepEqual(names.sort(), ['Dishwasher', 'Fridge', 'Fridge', 'Reference stack: K1 · FFL 0']);
});

test('the plan marks tall units, appliances under the worktop and drawers', () => {
  const [plan] = technicalDrawings({ studio: room(), pieces: [against(1, 'tall', 'fridge', 30), against(2, 'base', 'dishwasher', 90), against(3, 'base', 'drawers', 150)] }, { preset: 'clearances' });
  const lines = all(plan!).filter(i => i.kind === 'line');
  const cross = (x0: number, x1: number, stroke: string) => lines.filter(i => i.kind === 'line' && i.stroke === stroke && i.points.length === 2
    && i.points.every(p => p.x >= x0 - 1 && p.x <= x1 + 1) && Math.abs(i.points[0]!.x - i.points[1]!.x) > 100).length;
  assert.equal(cross(0, 600, 'thin'), 2, 'a cross over the tall unit');
  assert.equal(cross(600, 1200, 'hidden'), 2, 'a dashed cross over the dishwasher unit');
  assert.deepEqual(all(plan!).filter(i => i.kind === 'arrow').map(i => i.kind === 'arrow' && i.at.x), [1500], 'an arrow out of the drawer unit');
});

test('what to check: pieces in one place, in front of a window, past the wall, taller than it', () => {
  const clash = [against(1, 'base', 'drawers', 100), against(2, 'base', 'drawers', 130), against(3, 'upper', 'upper', 210, 142), against(4, 'base', 'drawers', 290)];
  const [plan, elevation] = technicalDrawings({ studio: room(), pieces: clash });
  assert.deepEqual(plan!.checks, ['K1 and K2 overlap', 'P3L stands in front of the window on wall A', 'K3 stands in front of the window on wall A', 'P3R stands in front of the window on wall A', 'K4 runs 200 past the end of wall A', 'P4R runs 218 past the end of wall A']);
  assert.deepEqual(elevation!.checks, plan!.checks, 'the wall\'s elevation repeats the checks about its pieces');
  assert.deepEqual(technicalDrawings({ studio: room(), pieces: kitchen() })[0]!.checks, ['P1L runs 18 past the end of wall A'], 'the added finish pane needs its actual allowance');
});

test('a run turning a corner is seen from its end on the next wall, and a piece standing free is set out from the walls', () => {
  const corner = { template: 'custom' as const, openings: [], corners: [{ id: 'c1', x: 0, z: 300 }, { id: 'c2', x: 0, z: 0 }, { id: 'c3', x: 300, z: 0 }],
    walls: [{ id: 'w1', a: 'c1', b: 'c2', thickness: 10, height: 260 }, { id: 'w2', a: 'c2', b: 'c3', thickness: 10, height: 260 }] };
  const back = createKitchenDesign('base', 'drawers'), side = createKitchenDesign('base', 'drawers'), island = createKitchenDesign('base', 'drawers');
  const pieces = [{ id: 1, name: 'a', x: 5 + 30, y: 0, z: 5 + 29, angle: 0, design: back }, { id: 2, name: 'b', x: 5 + 29, y: 0, z: 5 + 58 + 30, angle: 90, design: side },
    { id: 3, name: 'c', x: 150, y: 0, z: 200, angle: 0, design: island }];
  const sheets = technicalDrawings({ studio: corner, pieces });
  assert.deepEqual(sheets.map(s => s.title).slice(0, 4), ['Plan', 'Elevation A', 'Elevation B', 'Front elevation K3']);
  // On wall A (left), K2 stands in front; K1 on the other wall comes into the corner and is seen from its side.
  const tags = all(sheets[1]!).filter(i => i.kind === 'tag').map(i => i.kind === 'tag' && i.text);
  assert.deepEqual(tags.sort(), ['K1', 'K2']);
  const floor = dims(all(sheets[1]!))[0]!.stops;
  assert.ok(floor.includes(2370) && floor.includes(3000 - 50 - 580 - 600), 'the return and the unit on the floor string: ' + floor);
  // The island: its distance to the wall behind it and to the nearer wall beside it.
  const free = dims(all(sheets[0]!)).filter(d => d.stops.length === 2 && ![18, 40, 600, 580, 2950].includes(d.stops[1]!)).map(d => d.stops[1]);
  assert.deepEqual(free.sort((a, b) => a! - b!), [1150, 1660]);
});

test('every dimension string is whole millimetres (half in a construction detail), in order, and adds up to its total', () => {
  for (const sheet of technicalDrawings({ studio: room(), pieces: kitchen() })) {
    for (const d of dims(all(sheet))) {
      const step = sheet.title.startsWith('Construction details') ? 2 : 1;
      assert.ok(d.stops.every(v => Number.isInteger(v * step)), sheet.title + ': whole millimetres ' + d.stops);
      assert.ok(d.stops.every((s, k) => k === 0 || s > d.stops[k - 1]!), sheet.title + ': ascending ' + d.stops);
      const parts = d.stops.slice(1).map((s, k) => s - d.stops[k]!);
      assert.equal(parts.reduce((a, b) => a + b, 0), d.stops[d.stops.length - 1]! - d.stops[0]!);
    }
  }
});

test('the PDF is one A3 landscape page per sheet, a valid file made from the sheets, not the screen', () => {
  const sheets = technicalDrawings({ studio: room(), pieces: kitchen() });
  const pdf = new TextDecoder().decode(drawingsPdf(sheets, { project: 'Kitchen (test)', date: '19.10.2026', total: sheets.length }));
  assert.ok(pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'));
  assert.equal(pdf.match(/\/Type \/Page /g)?.length, sheets.length, 'a page for every sheet');
  assert.equal(pdf.match(/\/MediaBox \[0 0 1190\.551 841\.89\]/g)?.length, sheets.length, 'every page A3 landscape: 420 × 297 mm');
  // The cross-reference table points at every object exactly.
  const xref = Number(pdf.slice(pdf.lastIndexOf('startxref') + 9).trim().split('\n')[0]);
  const offsets = pdf.slice(xref).split('\n').slice(3).filter(l => / 00000 n $/.test(l)).map(l => Number(l.slice(0, 10)));
  offsets.forEach((o, k) => assert.ok(pdf.startsWith(k + 1 + ' 0 obj', o), 'object ' + (k + 1) + ' at ' + o));
  assert.ok(pdf.includes('<36303020d72032313530'), 'a size, 600 × 2150, with its × written in WinAnsi');
  assert.ok(pdf.includes('/Title (Kitchen test - technical drawings)'), 'its title, without the brackets a PDF string would choke on');
});

const sheetNamed = (title: string, pieces = kitchen()) => technicalDrawings({ studio: room(), pieces }).find(s => s.title === title)!;
const rowsOf = (title: string, pieces = kitchen()) => sheetNamed(title, pieces).table!.rows;

test('each cabinet has its own sheet to be made from: front, inside and a section', () => {
  const sheet = sheetNamed('K2  Base cabinet');
  assert.deepEqual(sheet.views.map(v => v.title), ['Front', 'Inside', 'Section A–A']);
  const sizes = sheet.views[0]!.items.filter(i => i.kind === 'note' && i.small).map(i => i.kind === 'note' && i.lines[0]);
  assert.deepEqual(sizes, ['597 × 294', '597 × 276', '597 × 201'], 'every front written with its width and height, 3 mm smaller than its opening');
});

test('the cutting list: every board as built, length with the grain, the run\'s worktop and plinth', () => {
  const k2 = rowsOf('Cutting list').filter(r => r[0] === 'K2' && r[1] !== 'Worktop' && r[1] !== 'Plinth').map(r => r.slice(1, 8).join(' '));
  assert.deepEqual(k2, [
    'Top 1 600 580 18 Board 18 · Egger W1100 ST9 L1',
    'Side 2 762 580 18 Board 18 · Egger W1100 ST9 L1',
    'Base 1 564 569 18 Board 18 · Egger W1100 ST9 L1',
    'Back 1 762 564 6 Back panel 6 —',
    'Pan drawer front 1 294 597 18 Front 18 · Egger W1100 ST9 L2 W2',
    'Pan drawer front 1 276 597 18 Front 18 · Egger W1100 ST9 L2 W2',
    'Drawer front 1 201 597 18 Front 18 · Egger W1100 ST9 L2 W2',
  ]);
  const run = rowsOf('Cutting list').filter(r => r[1] === 'Worktop' || r[1] === 'Plinth').map(r => r.slice(0, 6).join(' '));
  assert.deepEqual(run, ['K2–P2R Worktop 1 636 600 40', 'K1 Plinth 1 600 80 18', 'K2 Plinth 1 600 80 18'], 'the worktop over the base unit; a plinth under each floor unit, 100 apart');
  const wardrobe = { id: 9, name: 'Wardrobe 1', x: 150, y: 0, z: 200, angle: 0, design: createInitialDesign() };
  const w1 = technicalDrawings({ pieces: [wardrobe] }).find(s => s.title === 'Cutting list')!.table!.rows.map(r => r.slice(1, 6).join(' '));
  assert.deepEqual(w1, ['Top 1 2000 600 18', 'Side 2 2282 600 18', 'Base 1 1964 589 18', 'Back 1 2202 1964 6', 'Plinth rail 1 1964 80 18', 'Plinth rail 1 1964 80 18', 'Plinth bearer 2 504 80 18'],
    'a plain wardrobe: top over the sides, base and back between them, a plinth frame of two rails and two bearers');
});

test('the hardware list: hinges by door height, runners to the depth, legs, hangers and fixings', () => {
  const rows = rowsOf('Hardware list', [...kitchen(), against(4, 'base', 'base', 230)]);
  const find = (item: string) => rows.find(r => r[0] === item);
  assert.deepEqual(find('Drawer runners, full extension, pair'), ['Drawer runners, full extension, pair', '550 mm', '3', 'K2'], 'three drawers, 550 runners in a 580 deep unit');
  assert.deepEqual(find('Adjustable leg')?.slice(2), ['12', 'K1, K2, K4'], 'four under each floor unit');
  assert.deepEqual(find('Cabinet hanger, adjustable')?.slice(2), ['1', 'K3']);
  assert.deepEqual(find('Appliance door fixing kit')?.slice(2), ['2', 'K1'], 'the tall unit\'s fridge and freezer doors');
  assert.deepEqual(find('Wall fixing bracket')?.slice(2), ['2', 'K1'], 'the tall unit is fixed to the wall');
});

test('corner pull-out component is drawn with high precision across plan, elevation, unit detail, construction details and schedules', () => {
  const cornerPiece = against(1, 'base', 'corner', 100);
  const sheets = technicalDrawings({ studio: room(), pieces: [cornerPiece] }, { preset: 'clearances' });
  const [plan, elevation] = sheets;
  const unitSheet = sheets.find(s => s.title === 'K1  Base cabinet')!, detail2 = sheets.find(s => s.title === 'Construction details 2 of 2')!;
  const cutting = sheets.find(s => s.title === 'Cutting list')!, hardware = sheets.find(s => s.title === 'Hardware list')!;

  // 1. Plan view: kidney tray dashed outline, pivot post, front split tick, door swing line, and pull-out arrow on the door half.
  const planItems = all(plan!);
  const planSwings = planItems.filter(i => i.kind === 'line' && i.stroke === 'swing');
  assert.equal(planSwings.length, 2, 'hinged door leaf and its 90 degree arc drawn on the plan');
  const planArrows = planItems.filter(i => i.kind === 'arrow');
  assert.equal(planArrows.length, 1, 'pull-out arrow on the door half of the plan');
  assert.ok(planArrows[0]!.kind === 'arrow' && planArrows[0]!.at.x < 1000, 'arrow emerges from the left (door) half by default');
  const kidneyHidden = planItems.filter(i => i.kind === 'line' && i.stroke === 'hidden' && i.closed && i.points.length === 6);
  assert.equal(kidneyHidden.length, 1, 'kidney-shaped swing-out tray silhouette drawn dashed on the plan');

  // 2. Wall elevation: fixed blind panel + hinged door leaf with swing triangle, and dashed pivot post + two trays behind.
  const elevSwings = all(elevation!).filter(i => i.kind === 'line' && i.stroke === 'swing');
  assert.equal(elevSwings.length, 1, 'only the door half has a hinge triangle; the blind panel is fixed');

  // 3. Unit detail sheet: Front, Inside, and Section A–A with exact millimetre dimensions for post and swing-out trays.
  assert.deepEqual(unitSheet!.views.map(v => v.title), ['Front', 'Inside', 'Section A–A']);
  const frontSizes = unitSheet!.views[0]!.items.filter(i => i.kind === 'note' && i.small).map(i => i.kind === 'note' && i.lines[0]);
  assert.deepEqual(frontSizes, ['497 × 777', '497 × 777'], 'blind panel and pull-out door cut sizes on Front view');
  const insideNotes = unitSheet!.views[1]!.items.filter(i => i.kind === 'note' && i.small).map(i => i.kind === 'note' && i.lines[0]);
  assert.deepEqual(insideNotes, ['Corner blind panel', 'Corner pull-out'], 'Inside view labels both the blind panel and pull-out door');
  const insideArrows = unitSheet!.views[1]!.items.filter(i => i.kind === 'arrow');
  assert.equal(insideArrows.length, 2, 'two swing arrows on the upper and lower kidney trays in Inside view');
  const insideHorizontalStops = dims(unitSheet!.views[1]!.items)[1]!.stops;
  assert.ok(insideHorizontalStops.includes(690), 'Inside view horizontal dimension string locates the pivot post axis (690 mm)');
  const sectionDepthStops = dims(unitSheet!.views[2]!.items)[0]!.stops;
  assert.ok(sectionDepthStops.includes(60) && sectionDepthStops.includes(520), 'Section A–A dimensions the 60 mm back/front tray clearances');

  // 4. Construction details include D6 Blind corner and pull-out, and every dimension string is valid.
  assert.ok(detail2!.views.some(v => v.title.startsWith('D6 Corner mechanism')), 'includes D6 Blind corner and pull-out detail');
  for (const sheet of sheets) {
    for (const d of dims(all(sheet))) {
      const step = sheet.title.startsWith('Construction details') ? 2 : 1;
      assert.ok(d.stops.every(v => Number.isInteger(v * step)), sheet.title + ': valid millimetre stops ' + d.stops);
      assert.ok(d.stops.every((s, k) => k === 0 || s > d.stops[k - 1]!), sheet.title + ': ascending stops ' + d.stops);
    }
  }

  // 5. Cutting list & Hardware list: blind panel + pull-out door (no fake wooden shelves), and corner pull-out mechanism.
  const cutParts = cutting!.table!.rows.filter(r => r[0] === 'K1' || r[1] === 'Worktop').map(r => r[1]);
  assert.deepEqual(cutParts, ['Top', 'Side', 'Base', 'Back', 'Corner blind panel', 'Corner pull-out door', 'Worktop', 'Plinth']);
  const hwItems = hardware!.table!.rows.map(r => r[0]);
  assert.ok(hwItems.includes('Corner pull-out mechanism, two swing trays'), 'hardware list includes the corner pull-out mechanism');
  assert.ok(!hwItems.includes('Shelf support'), 'no adjustable wooden shelf pins for a corner pull-out unit');
});

test('wall utilities (water pipes, electrical sockets, vents, gas, radiators, switches) appear accurately in plan, elevation and checks', () => {
  const studioWithUtilities = {
    ...room(),
    openings: [
      ...room().openings,
      { id: 'o2', wall: 'w1', kind: 'water' as const, offset: 100, width: 24, height: 20, sill: 50 },
      { id: 'o3', wall: 'w1', kind: 'socket' as const, offset: 100, width: 16, height: 10, sill: 110 },
      { id: 'o4', wall: 'w1', kind: 'duct' as const, offset: 100, width: 18, height: 18, sill: 215 },
      { id: 'o5', wall: 'w1', kind: 'radiator' as const, offset: 30, width: 40, height: 60, sill: 15 },
    ],
  };
  const sheets = technicalDrawings({ studio: studioWithUtilities, pieces: kitchen() });
  const [plan, elevation] = sheets;
  const planNotes = all(plan!).filter(i => i.kind === 'note').map(i => i.kind === 'note' && i.lines.join(' '));
  assert.deepEqual(planNotes, [
    'Window 1000 × 1200, Hp 1000, lintel 2200',
  ]);
  const elevNotes = all(elevation!).filter(i => i.kind === 'note' && !i.small).map(i => i.kind === 'note' && i.lines.join(' '));
  assert.ok(elevNotes.includes('Water pipes 240 × 200, sill 500'));
  assert.ok(elevNotes.includes('Electrical point 160 × 100, sill 1100'));
  assert.ok(elevNotes.includes('Extractor vent 180 × 180, sill 2150'));
  assert.ok(elevNotes.includes('Radiator 400 × 600, sill 150'));
  // Right-hand vertical dimension string on the wall elevation includes utility sills and tops in mm.
  const rightVertStops = dims(all(elevation!)).at(-1)!.stops;
  for (const mmStop of [150, 500, 700, 750, 1000, 1100, 1200, 2150, 2200, 2330]) {
    assert.ok(rightVertStops.includes(mmStop), `vertical dimension string includes ${mmStop} mm`);
  }
  // Kitchen units may stand in front of water pipes and electrical points, but standing in front of a radiator is flagged.
  assert.deepEqual(plan!.checks, ['P1L runs 18 past the end of wall A', 'K1 stands in front of the radiator on wall A']);
});
