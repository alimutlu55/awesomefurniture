import test from 'node:test';
import assert from 'node:assert/strict';
import { rectangleStudio, createStudio } from '../../src/domain/studio/studio-templates';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { placePieces, type DrawingPiece } from '../../src/domain/drawings/room-pieces';
import { planClearances } from '../../src/domain/drawings/plan-clearances';
import { pieceOperations } from '../../src/domain/drawings/plan-operations';
import { type Dimensions, type Item } from '../../src/domain/drawings/drawing';
import { unitAxes } from '../../src/domain/kitchen/kitchen-runs';

const unit = (id: number, x: number, z: number, angle = 0, preset = 'drawers'): DrawingPiece => ({
  id, name: 'Unit', x, y: 0, z, angle, design: createKitchenDesign('base', preset),
});
const vertical = (items: readonly Item[]) => items.filter((i): i is Dimensions => i.kind === 'dims' && i.dir.y === 1 && i.side === 1);

test('ENV-01: all room elevations have three height tiers and an uninterrupted outer ceiling total', () => {
  const studio = rectangleStudio(400, 350), p = unit(1, 0, 29);
  const sheets = technicalDrawings({ studio, pieces: [p, { ...unit(2, 0, 17.5), y: 142, design: createKitchenDesign('upper', 'upper') }] });
  const elevations = sheets.filter(s => s.title.startsWith('Elevation'));
  assert.equal(elevations.length, 4, 'all walls, including three without furniture');
  for (const sheet of elevations) {
    const tiers = vertical(sheet.views[0]!.items);
    assert.deepEqual(tiers.map(d => d.row), [0, 1, 2]);
    assert.deepEqual(tiers[2]!.stops, [0, 2600]);
  }
  const [zones, datums] = vertical(elevations[0]!.views[0]!.items);
  assert.ok(zones!.stops.length > datums!.stops.length, 'zone subdivisions belong to the inner chain');
  for (const value of [80, 900, 1420]) assert.ok(datums!.stops.includes(value), 'installation datum ' + value);
  const free = technicalDrawings({ studio, pieces: [unit(3, 0, 175)] }).find(s => s.title.startsWith('Front elevation'))!;
  assert.deepEqual(vertical(free.views[0]!.items)[2]!.stops, [0, 2600], 'island uses room height');
  const noRoom = technicalDrawings({ pieces: [p] }).find(s => s.title.startsWith('Front elevation'))!;
  assert.deepEqual(vertical(noRoom.views[0]!.items)[2]!.stops, [0, 860], 'without a room only the piece height is known');
});

test('ENV-02: room-only drawings retain doors, window Hp/lintel, radiators, wall thickness and every elevation', () => {
  const studio = { ...rectangleStudio(400, 350), openings: [
    { id: 'door', wall: 'w2', kind: 'door' as const, offset: 180, width: 80, height: 205, sill: 0, hinge: 'left' as const, swing: 'in' as const },
    { id: 'window', wall: 'w3', kind: 'window' as const, offset: 180, width: 100, height: 120, sill: 90 },
    { id: 'rad', wall: 'w4', kind: 'radiator' as const, offset: 100, width: 80, height: 60, sill: 15 },
  ] };
  const before = JSON.stringify(studio), sheets = technicalDrawings({ studio, pieces: [] });
  assert.equal(sheets.filter(s => s.title.startsWith('Elevation')).length, 4);
  const plan = sheets[0]!.views[0]!.items;
  const notes = plan.filter(i => i.kind === 'note').flatMap(i => i.lines);
  assert.ok(notes.includes('Window 1000 × 1200, Hp 900, lintel 2100'));
  assert.ok(notes.includes('Door 800 × 2050, lintel 2050'));
  assert.ok(notes.includes('Radiator 800 × 600, sill 150'));
  const arc = plan.find(i => i.kind === 'line' && i.stroke === 'swing' && i.points.length === 19);
  assert.ok(arc?.kind === 'line');
  assert.equal(Math.round(Math.hypot(arc.points[0]!.x - arc.points.at(-1)!.x, arc.points[0]!.y - arc.points.at(-1)!.y)), 1131);
  assert.ok(plan.some(i => i.kind === 'line' && i.fill === 'hatch'), 'solid walls exported at real thickness');
  assert.equal(JSON.stringify(studio), before, 'serialization never changes the design');
});

test('ENV-02: open perimeter ends carry break marks without a fictitious closing wall', () => {
  const sheets = technicalDrawings({ studio: createStudio('corner'), pieces: [] });
  const plan = sheets[0]!.views[0]!.items;
  assert.equal(plan.filter(i => i.kind === 'line' && i.stroke === 'cut' && !i.closed && i.points.length === 5).length, 2);
  assert.equal(sheets.filter(s => s.title.startsWith('Elevation')).length, 2);
  for (const elevation of sheets.slice(1, 3)) {
    assert.ok(elevation.views[0]!.items.some(i => i.kind === 'line' && i.points.length === 6 && !i.closed), 'vertical break on open end');
    assert.ok(elevation.views[0]!.items.some(i => i.kind === 'line' && i.fill === 'hatch'), 'adjoining wall section');
  }
});

test('ENV-03: base doors have true 90 degree arcs; drawers extend by runner length and appliance doors by leaf height', () => {
  const pieces = placePieces({ pieces: [unit(1, 0, 0, 0, 'fridge-under'), unit(2, 100, 0), unit(3, 200, 0, 0, 'dishwasher')] });
  const door = pieceOperations(pieces[0]!)[0]!;
  const pivot = door.points[0]!, arc = door.points.slice(1);
  const radius = Math.hypot(arc[0]!.x - pivot.x, arc[0]!.y - pivot.y);
  for (const q of arc) assert.ok(Math.abs(Math.hypot(q.x - pivot.x, q.y - pivot.y) - radius) < 1.5);
  assert.ok(Math.abs((arc[0]!.x - pivot.x) * (arc.at(-1)!.x - pivot.x)
    + (arc[0]!.y - pivot.y) * (arc.at(-1)!.y - pivot.y)) < 1, 'sweep endpoints perpendicular');
  const drawer = pieceOperations(pieces[1]!)[0]!.points;
  assert.equal(Math.abs(drawer[2]!.y - drawer[1]!.y), 550, 'same full-extension runner as the hardware schedule');
  const drop = pieceOperations(pieces[2]!)[0]!;
  assert.equal(Math.abs(drop.points[2]!.y - drop.points[1]!.y), Math.round((drop.top - drop.bottom) * 10));
  const wardrobe = placePieces({ pieces: [{ ...unit(4, 0, 0), design: { ...createInitialDesign(), secs: [[{ k: 'drawer', h: 22 }], [], []] } }] })[0]!;
  assert.ok(pieceOperations(wardrobe).some(o => o.points.length === 4), 'wardrobe drawers are also projected');
});

test('ENV-03: opposing worktops measure the true minimum aisle, once, with narrow-aisle and opening-clash checks', () => {
  const studio = rectangleStudio(400, 200);
  const pieces = placePieces({ studio, pieces: [unit(1, 0, 29), unit(2, 0, 171, 180)] });
  const { items, checks } = planClearances(studio, pieces);
  const dimensions = items.filter((i): i is Dimensions => i.kind === 'dims');
  assert.equal(dimensions.length, 1, 'opposing runs share one aisle measurement');
  assert.deepEqual(dimensions[0]!.stops, [0, 800], '2000 clear room minus two 600 worktops');
  assert.ok(checks.some(c => c.includes('aisle clearance 800')));
  const tight = placePieces({ studio, pieces: [unit(1, 0, 29, 0, 'dishwasher'), unit(2, 0, 120, 180)] });
  assert.ok(planClearances(studio, tight).checks.some(c => c.includes('K1 opening envelope meets K2')));
});

test('ENV-03: minimum scans the whole cabinet width, works after rotation and includes radiator projections', () => {
  for (const angle of [0, 37, 90, 180, 270]) {
    const { u, v } = unitAxes(angle), point = (s: number, t: number) => ({ x: u.x * s + v.x * t, z: u.z * s + v.z * t });
    const a = point(0, 0), b = point(12, 110);
    const source = unit(1, a.x, a.z, angle), target = { ...unit(2, b.x, b.z, angle + 180), design: { ...createKitchenDesign('base', 'base'), w: 5 } };
    const items = planClearances(undefined, placePieces({ pieces: [source, target] })).items;
    assert.ok(items.some(i => i.kind === 'dims' && Math.abs(i.stops[1]! - 480) <= 2), 'narrow obstacle between sample rays at ' + angle);
  }
  const studio = { ...rectangleStudio(400, 200), openings: [
    { id: 'r', wall: 'w3', kind: 'radiator' as const, offset: 206, width: 80, height: 60, sill: 15 },
  ] };
  const result = planClearances(studio, placePieces({ studio, pieces: [unit(1, 0, 29)] }));
  assert.ok(result.items.some(i => i.kind === 'dims' && i.stops[1] === 1300), 'radiator projects 100 mm beyond the opposing wall');
});

test('ENV-03: floor-level archways are passable and hanging fronts ignore furniture below their swept height', () => {
  const studio = { ...rectangleStudio(400, 200), openings: [
    { id: 'a', wall: 'w3', kind: 'archway' as const, offset: 206, width: 100, height: 210, sill: 0 },
  ] };
  const pieces = placePieces({ studio, pieces: [unit(1, 0, 29)] });
  assert.equal(planClearances(studio, pieces).items.length, 0, 'open doorway is not a solid wall or invented aisle endpoint');
  const upper = { ...unit(2, 0, 0), y: 142, design: createKitchenDesign('upper') };
  const below = { ...unit(3, 0, 45), design: createKitchenDesign('base', 'base') };
  assert.ok(!planClearances(undefined, placePieces({ pieces: [upper, below] })).checks.some(c => c.startsWith('K1 opening')), 'upper door clears low furniture');
});

test('ENV-01: compressed height labels remain separated within and between the three paper tiers', async () => {
  const { dimensionMarks } = await import('../../src/presentation/drawings/dimension-marks');
  const { layoutSheet } = await import('../../src/presentation/drawings/sheet-layout');
  const studio = rectangleStudio(400, 300);
  const pieces = [unit(1, 0, 29), { ...unit(2, 80, 29), design: createKitchenDesign('tall', 'fridge') },
    { ...unit(3, 0, 17.5), y: 142, design: createKitchenDesign('upper') }];
  const sheet = technicalDrawings({ studio, pieces }).find(s => s.title === 'Elevation A')!, { paper } = layoutSheet(sheet).placed[0]!;
  const figures: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const d of vertical(sheet.views[0]!.items)) dimensionMarks(d, paper, figures);
  for (let i = 0; i < figures.length; i++) for (let j = i + 1; j < figures.length; j++) {
    const a = figures[i]!, b = figures[j]!;
    assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, 'height labels overlap');
  }
});


test('room elevation keeps construction details and close but unrelated tops out of the shared height chains', () => {
  const studio = rectangleStudio(400, 300);
  const pieces = [unit(1, 0, 29), { ...unit(2, -60, 29), design: createKitchenDesign('tall', 'fridge') },
    { ...unit(3, 0, 17.5), y: 142, design: createKitchenDesign('upper') }];
  const sheets = technicalDrawings({ studio, pieces }), [units, datums, total] = vertical(sheets.find(s => s.title === 'Elevation A')!.views[0]!.items);
  assert.deepEqual(units!.stops, [0, 80, 860, 900, 1420, 2120, 2600]);
  assert.deepEqual(datums!.stops, [0, 80, 900, 1420, 2600]);
  assert.deepEqual(total!.stops, [0, 2600]);
  assert.ok(!units!.stops.includes(2150), 'tall top is not confused with the adjacent upper top');
  const tall = sheets.find(s => s.title.includes('Tall cabinet'))!;
  assert.ok(tall.views.some(v => v.items.some(i => i.kind === 'dims' && i.stops.includes(2150))), 'tall cabinet still has its exact shop dimensions');
  const base = sheets.find(s => s.title.includes('Base cabinet'))!;
  assert.ok(base.views.some(v => v.items.some(i => i.kind === 'dims' && i.stops.some((s, k) => k > 0 && s - i.stops[k - 1]! === 18))),
    '18 mm board details remain on the shop sheet');
});


test('a wide base beneath unequal upper units uses a single vertical slice rather than merging their tops', () => {
  const studio = rectangleStudio(400, 300), upper = createKitchenDesign('upper');
  const pieces = [{ ...unit(1, 0, 29), design: { ...createKitchenDesign('base'), w: 120 } },
    { ...unit(2, -30, 17.5), y: 142, design: upper },
    { ...unit(3, 30, 17.5), y: 142, design: { ...upper, h: upper.h + 1 } }];
  const [units] = vertical(technicalDrawings({ studio, pieces }).find(s => s.title === 'Elevation A')!.views[0]!.items);
  assert.ok(!(units!.stops.includes(2120) && units!.stops.includes(2130)), 'no artificial 10 mm segment between separate cabinets');
});
